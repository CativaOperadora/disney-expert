-- =====================================================================
-- DISNEY EXPERT · Migração 016
-- Caixa de notificações para a equipe interna (especialistas).
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_016_notificacoes_internas.sql
--
-- Reexecução é segura.
--
-- POR QUE AGORA
--   A migração 012 criou a central de notificações só para o Portal, e o
--   comentário dela registrou o motivo: "a equipe interna ainda entra com
--   senha compartilhada, então não há a quem endereçar; isso muda quando o
--   login individual chegar (Fase 4)". A 013 trouxe o login individual em
--   `usuarios`. Esta migração fecha a pendência.
--
-- A FRONTEIRA CONTINUA DE PÉ
--   O isolamento nunca foi "a tabela é só do Portal": é que nenhum evento
--   do lado consultoria pode chegar à agência. Isso não muda aqui. O que
--   passa a existir é o caminho oposto — um evento que a consultoria
--   precisa saber, endereçado a quem é da casa.
--
--   A separação é estrutural, não uma convenção de consulta: o
--   destinatário mora em UMA das duas colunas, e as consultas do Portal
--   filtram por `destinatario_id`, que é NULO em toda linha interna. Um
--   NULL não casa com id nenhum — não existe filtro esquecido capaz de
--   entregar aviso interno para agência.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. NOVO TIPO DE ENVIO
--
-- `copia_especialista` era UMA cópia para o endereço fixo do .env
-- (EMAIL_ESPECIALISTA). Agora sai um aviso por especialista ativa, com o
-- endereço vindo de `usuarios`. Tipo novo em vez de reaproveitar o antigo:
-- os envios já gravados continuam significando o que significavam, e o
-- histórico não fica ambíguo.
--
-- ALTER TYPE ADD VALUE não roda dentro de transação: fica solto, antes do
-- begin. Mesma restrição já enfrentada na migração 006.
-- ---------------------------------------------------------------------
alter type tipo_envio add value if not exists 'aviso_especialista';

begin;

-- ---------------------------------------------------------------------
-- 1. DESTINATÁRIO INTERNO
--
-- `destinatario_id` (agentes) deixa de ser obrigatório para abrir espaço a
-- `destinatario_usuario_id` (usuarios). O CHECK garante que exatamente um
-- dos dois está preenchido: linha sem dono, ou com dois donos, não entra.
-- ---------------------------------------------------------------------
alter table notificacoes alter column destinatario_id drop not null;

alter table notificacoes
  add column if not exists destinatario_usuario_id uuid
    references usuarios(id) on delete cascade;

comment on column notificacoes.destinatario_id is
  'Agente do Portal. Nulo quando o aviso é da equipe interna.';
comment on column notificacoes.destinatario_usuario_id is
  'Pessoa do time interno (usuarios). Nulo quando o aviso é do Portal.';

alter table notificacoes drop constraint if exists notificacoes_um_destinatario;
alter table notificacoes add constraint notificacoes_um_destinatario check (
  (destinatario_id is not null and destinatario_usuario_id is null)
  or
  (destinatario_id is null and destinatario_usuario_id is not null)
);

-- ---------------------------------------------------------------------
-- 2. ÍNDICES DA CAIXA INTERNA
--
-- Espelham os do Portal: a caixa ordenada por data, e o índice parcial que
-- faz o contador de não lidas ser uma agregação barata — o sino consulta a
-- cada 30 segundos.
-- ---------------------------------------------------------------------
create index if not exists notificacoes_caixa_interna_idx
  on notificacoes (destinatario_usuario_id, criado_em desc);
create index if not exists notificacoes_interna_nao_lidas_idx
  on notificacoes (destinatario_usuario_id) where lida_em is null;

-- ---------------------------------------------------------------------
-- 3. COMENTÁRIOS ATUALIZADOS
-- ---------------------------------------------------------------------
comment on table notificacoes is
  'Central de notificações das duas áreas. Uma linha por destinatário. O destinatário é um agente do Portal OU alguém do time interno, nunca os dois. Nenhum evento do andamento da consultoria é endereçado a agente: isso exporia o interno.';

comment on column notificacoes.tipo is
  'Portal: solicitacao_nova, card_movido, seguidor_adicionado, venda_finalizada, nota_agencia. Interno: solicitacao_nova_interna.';

commit;

-- ---------------------------------------------------------------------
-- Conferência.
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'notificacoes'
      and column_name = 'destinatario_usuario_id')          as coluna_criada,
  (select count(*) from information_schema.table_constraints
    where table_name = 'notificacoes'
      and constraint_name = 'notificacoes_um_destinatario')  as check_criado,
  (select count(*) from usuarios
    where papel = 'especialista' and ativo)                  as especialistas_ativas;

-- As especialistas que passarão a receber aviso de solicitação nova.
select nome, email, ativo from usuarios
where papel = 'especialista' and ativo order by nome;
