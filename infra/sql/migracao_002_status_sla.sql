-- =====================================================================
-- DISNEY EXPERT · Migração 002 (corrigida)
-- Novos status do CRM, marco de primeiro atendimento e base do SLA.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_002_status_sla.sql
--
-- Correção em relação à primeira versão: tudo que depende do tipo antigo
-- (view, índice parcial e restrições) precisa sair ANTES da conversão.
-- O índice `solicitacoes_fila_idx` tinha `where status not in (...)`,
-- e era ele que travava a troca.
--
-- Mapeamento aplicado nos registros existentes:
--   novo, triagem                                -> nova_solicitacao
--   em_analise                                   -> em_atendimento
--   consultoria_entregue, com_agencia, follow_up -> consultoria_realizada
--   ganho                                        -> venda_finalizada
--   perdido                                      -> venda_perdida
--   duplicada                                    -> duplicada
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Remover tudo que depende do tipo antigo
-- ---------------------------------------------------------------------
drop view  if exists fila_atendimento;
drop index if exists solicitacoes_fila_idx;
drop index if exists solicitacoes_abertas_idx;

alter table solicitacoes drop constraint if exists chk_motivo_perda;
alter table solicitacoes drop constraint if exists chk_duplicada;

-- ---------------------------------------------------------------------
-- 2. Converter o tipo
-- ---------------------------------------------------------------------
create type status_solicitacao_novo as enum (
  'nova_solicitacao',
  'em_atendimento',
  'consultoria_realizada',
  'venda_finalizada',
  'venda_perdida',
  'duplicada'
);

alter table solicitacoes alter column status drop default;

alter table solicitacoes
  alter column status type status_solicitacao_novo
  using (
    case status::text
      when 'novo'                 then 'nova_solicitacao'
      when 'triagem'              then 'nova_solicitacao'
      when 'em_analise'           then 'em_atendimento'
      when 'consultoria_entregue' then 'consultoria_realizada'
      when 'com_agencia'          then 'consultoria_realizada'
      when 'follow_up'            then 'consultoria_realizada'
      when 'ganho'                then 'venda_finalizada'
      when 'perdido'              then 'venda_perdida'
      else 'duplicada'
    end::status_solicitacao_novo
  );

alter table solicitacoes alter column status set default 'nova_solicitacao';

drop type status_solicitacao;
alter type status_solicitacao_novo rename to status_solicitacao;

-- ---------------------------------------------------------------------
-- 3. Recriar as restrições já com os valores novos
-- ---------------------------------------------------------------------
alter table solicitacoes add constraint chk_motivo_perda
  check ((status = 'venda_perdida') = (motivo_perda is not null));

alter table solicitacoes add constraint chk_duplicada
  check ((status = 'duplicada') or (duplicada_de is null));

-- ---------------------------------------------------------------------
-- 4. SLA
-- O relógio mede o tempo até o PRIMEIRO atendimento, não até a conclusão.
-- Para quando a solicitação sai de 'nova_solicitacao'.
-- ---------------------------------------------------------------------
alter table solicitacoes
  add column if not exists primeiro_atendimento_em timestamptz;

comment on column solicitacoes.primeiro_atendimento_em is
  'Momento em que a solicitação saiu de nova_solicitacao pela primeira vez. Nulo significa que o relógio do SLA ainda está correndo.';

update solicitacoes s
set primeiro_atendimento_em = coalesce(
      (select min(e.criado_em) from eventos e
       where e.solicitacao_id = s.id and e.tipo = 'status_alterado'),
      s.criado_em)
where s.status <> 'nova_solicitacao'
  and s.primeiro_atendimento_em is null;

-- ---------------------------------------------------------------------
-- 5. Prazo por tier da agência, em horas corridas
-- ---------------------------------------------------------------------
alter table agencias
  add column if not exists sla_horas smallint not null default 48;

update agencias set sla_horas = 24 where tier = 'select';

comment on column agencias.sla_horas is
  'Prazo de primeiro atendimento em horas corridas. Select 24, demais 48. Acompanha o tier automaticamente pelo gatilho.';

create or replace function ajustar_sla_por_tier() returns trigger
language plpgsql as $$
begin
  if new.tier is distinct from old.tier then
    new.sla_horas := case when new.tier = 'select' then 24 else 48 end;
  end if;
  return new;
end;
$$;

drop trigger if exists agencias_sla on agencias;
create trigger agencias_sla before update on agencias
  for each row execute function ajustar_sla_por_tier();

-- ---------------------------------------------------------------------
-- 6. Índices e visão, agora sobre o tipo novo
-- ---------------------------------------------------------------------
create index solicitacoes_fila_idx
  on solicitacoes (criado_em asc)
  where status = 'nova_solicitacao';

create index solicitacoes_abertas_idx
  on solicitacoes (status, criado_em desc);

create view fila_atendimento as
select
  s.id, s.protocolo, s.status, s.perfil, s.completude,
  s.cliente_nome, s.data_prevista, s.total_pessoas, s.total_criancas,
  s.criado_em, s.primeiro_atendimento_em,
  ag.nome as agencia_nome,
  ag.tier as agencia_tier,
  ag.sla_horas,
  s.criado_em + make_interval(hours => ag.sla_horas) as sla_vence_em,
  a.nome  as agente_nome,
  a.email as agente_email,
  u.nome  as responsavel_nome
from solicitacoes s
left join agentes  a  on a.id  = s.agente_id
left join agencias ag on ag.id = s.agencia_id
left join usuarios u  on u.id  = s.responsavel_id
where s.status <> 'duplicada'
order by s.criado_em asc;

commit;
commit;
