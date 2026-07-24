-- =====================================================================
-- DISNEY EXPERT · Migração 004
-- Base financeira para o módulo de BI/Dashboards.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_004_bi_financeiro.sql
--
-- Conteúdo:
--   1. valor_total_venda · valor da venda, preenchido pela especialista.
--      Obrigatório para marcar a solicitação como "Venda finalizada".
--   2. venda_em · momento em que a venda foi fechada. Base do faturamento
--      por período e do tempo entre consultoria e fechamento.
-- =====================================================================

begin;

alter table solicitacoes
  add column if not exists valor_total_venda numeric(12,2),
  add column if not exists venda_em          timestamptz;

comment on column solicitacoes.valor_total_venda is
  'Valor total da venda em reais. Preenchido pela especialista ao concluir a venda; base dos indicadores financeiros do BI.';
comment on column solicitacoes.venda_em is
  'Momento em que a solicitação entrou em "venda_finalizada" pela primeira vez. Base do faturamento por período.';

-- Retroalimenta venda_em para vendas já existentes, usando o evento de
-- mudança de status quando houver, ou a data de atualização como aproximação.
update solicitacoes s
set venda_em = coalesce(
      (select min(e.criado_em) from eventos e
       where e.solicitacao_id = s.id
         and e.tipo = 'status_alterado'
         and e.payload->>'para' = 'venda_finalizada'),
      s.atualizado_em)
where s.status = 'venda_finalizada'
  and s.venda_em is null;

create index if not exists solicitacoes_venda_em_idx on solicitacoes (venda_em);

commit;
