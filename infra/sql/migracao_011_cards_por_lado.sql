-- =====================================================================
-- DISNEY EXPERT · Migração 011
-- Pipelines independentes: um card por lado da negociação.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_011_cards_por_lado.sql
--
-- O PROBLEMA QUE ISTO RESOLVE
--   Até aqui, `solicitacoes.status` era uma coluna única: a etapa que a
--   especialista registrava era a mesma que a agência via. O mesmo valia
--   para valor da venda e motivo de perda.
--
--   Isso está errado para o negócio. A agência pode reduzir a própria
--   comissão para dar desconto, ou aumentá-la e cobrar mais caro — o que
--   a Cativa recebe e o que a agência recebe DIVERGEM por natureza. E o
--   andamento interno da consultoria não é assunto da agência.
--
-- O DESENHO
--   `solicitacoes` guarda apenas o que é compartilhado: cliente, briefing,
--   agência de origem. Tudo que é operacional passa para `cards`, uma
--   linha por lado:
--
--     lado='consultoria'  -> o que a especialista registra (CRM interno)
--     lado='agencia'      -> o que o agente registra (Portal)
--
--   Um lado nunca lê o outro. O roteamento é uma regra só: painel usa
--   'consultoria', portal usa 'agencia'.
-- =====================================================================

-- Reexecução é segura: rodar de novo não altera nada e não dá erro.
-- CREATE TYPE não aceita IF NOT EXISTS, daí o bloco DO.
begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lado_card') then
    create type lado_card as enum ('consultoria', 'agencia');
  end if;
end $$;

create table if not exists cards (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  lado           lado_card not null,

  status         status_solicitacao not null default 'nova_solicitacao',
  status_em      timestamptz,
  primeiro_atendimento_em timestamptz,

  -- Só faz sentido no lado da consultoria (qual especialista conduz).
  responsavel_id uuid references usuarios(id) on delete set null,

  valor_total_venda numeric(12,2),
  venda_em          timestamptz,
  id_reserva        text,

  motivo_perda    motivo_perda,
  descricao_perda text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint cards_solicitacao_lado_uniq unique (solicitacao_id, lado),

  -- Motivo obrigatório ao perder, mas SÓ na consultoria: o agente move o
  -- card dele sem modal e sem motivo, por decisão de produto. A regra de
  -- permissão vira restrição de banco em vez de depender da interface.
  constraint chk_motivo_perda_card check (
    lado <> 'consultoria'
    or ((status = 'venda_perdida') = (motivo_perda is not null))
  )
);

comment on table cards is
  'Estado operacional de uma solicitação, por lado. A consultoria e a agência mantêm pipelines independentes: status, valor e motivo de perda NÃO são compartilhados.';
comment on column cards.lado is
  'consultoria = CRM interno da Cativa. agencia = Portal do Agente. Um lado nunca enxerga o card do outro.';
comment on column cards.valor_total_venda is
  'Valor registrado por ESTE lado. Divergir do outro lado é esperado: a agência ajusta a própria comissão.';

create index if not exists cards_solicitacao_idx on cards (solicitacao_id);
create index if not exists cards_lado_status_idx on cards (lado, status);
create index if not exists cards_responsavel_idx on cards (responsavel_id) where lado = 'consultoria';
create index if not exists cards_venda_idx       on cards (lado, venda_em) where status = 'venda_finalizada';

drop trigger if exists cards_touch on cards;
create trigger cards_touch before update on cards
  for each row execute function tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- Migração dos dados
--
-- Os dois lados nascem com o estado atual. Até agora eles compartilhavam
-- de fato, então copiar preserva a continuidade: ninguém perde histórico
-- ao entrar no dia seguinte. A partir daqui, evoluem separados.
-- ---------------------------------------------------------------------
insert into cards (
  solicitacao_id, lado, status, status_em, primeiro_atendimento_em,
  responsavel_id, valor_total_venda, venda_em, id_reserva,
  motivo_perda, descricao_perda, criado_em
)
select
  s.id, l.lado, s.status, s.status_em, s.primeiro_atendimento_em,
  -- responsavel_id é da consultoria; no lado da agência não se aplica.
  case when l.lado = 'consultoria' then s.responsavel_id end,
  s.valor_total_venda, s.venda_em, s.id_reserva,
  s.motivo_perda, s.descricao_perda, s.criado_em
from solicitacoes s
cross join (values ('consultoria'::lado_card), ('agencia'::lado_card)) as l(lado)
-- Numa reexecução os cards já existem: não sobrescreve o que evoluiu
-- depois da primeira migração. Copiar de novo apagaria o trabalho feito.
on conflict (solicitacao_id, lado) do nothing;

-- ---------------------------------------------------------------------
-- As colunas antigas ficam CONGELADAS, não são removidas.
--
-- Nenhum código volta a escrever nelas. Mantê-las por um ciclo dá uma
-- rede de segurança: se algo no deploy sair errado, o estado original
-- continua disponível para conferência sem precisar restaurar backup.
-- Uma migração posterior remove, depois de a operação rodar estável.
-- ---------------------------------------------------------------------
comment on column solicitacoes.status is
  'CONGELADA na migração 011. O estado operacional vive em cards.status, por lado. Não escreva aqui.';
comment on column solicitacoes.valor_total_venda is
  'CONGELADA na migração 011. Ver cards.valor_total_venda, por lado.';
comment on column solicitacoes.motivo_perda is
  'CONGELADA na migração 011. Ver cards.motivo_perda (só lado consultoria).';

-- A view antiga lê solicitacoes.status, que deixou de ser atualizado.
-- Passa a ler o card da consultoria, que é o que ela sempre quis dizer.
drop view if exists fila_atendimento;
create view fila_atendimento as
select
  s.id, s.protocolo, c.status, s.perfil, s.completude,
  s.cliente_nome, s.data_prevista, s.total_pessoas, s.total_criancas,
  s.criado_em, c.primeiro_atendimento_em,
  ag.nome as agencia_nome,
  ag.tier as agencia_tier,
  ag.sla_horas,
  s.criado_em + make_interval(hours => ag.sla_horas) as sla_vence_em,
  a.nome  as agente_nome,
  a.email as agente_email,
  u.nome  as responsavel_nome
from solicitacoes s
join cards c on c.solicitacao_id = s.id and c.lado = 'consultoria'
left join agentes  a  on a.id  = s.agente_id
left join agencias ag on ag.id = s.agencia_id
left join usuarios u  on u.id  = c.responsavel_id
where c.status <> 'duplicada'
order by s.criado_em asc;

commit;

-- Conferência: deve haver exatamente 2 cards por solicitação.
select
  (select count(*) from solicitacoes)                        as solicitacoes,
  (select count(*) from cards)                               as cards,
  (select count(*) from cards where lado = 'consultoria')    as consultoria,
  (select count(*) from cards where lado = 'agencia')        as agencia,
  (select count(*) from solicitacoes s
    where (select count(*) from cards c where c.solicitacao_id = s.id) <> 2) as sem_os_dois_lados;
