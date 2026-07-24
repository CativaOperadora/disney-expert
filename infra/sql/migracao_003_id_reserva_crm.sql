-- =====================================================================
-- DISNEY EXPERT · Migração 003
-- Ajustes do CRM da especialista (Orlando Expert).
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_003_id_reserva_crm.sql
--
-- Conteúdo:
--   1. Campo interno "ID da Reserva" na solicitação.
--   2. A coluna "Em atendimento" saiu do Kanban. Os cartões que ainda
--      estavam nesse status passam para "Em consultoria"
--      (consultoria_realizada), para não ficarem sem coluna.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. ID da Reserva · uso interno da especialista
-- ---------------------------------------------------------------------
alter table solicitacoes
  add column if not exists id_reserva text;

comment on column solicitacoes.id_reserva is
  'Identificador da reserva, preenchido pela especialista quando a venda é concluída. Uso interno, editável a qualquer momento.';

-- ---------------------------------------------------------------------
-- 2. Realocar cartões da coluna removida "Em atendimento"
-- O valor 'em_atendimento' segue existindo no enum, mas não é mais usado
-- pelo aplicativo; nenhuma solicitação deve permanecer nele.
-- ---------------------------------------------------------------------
update solicitacoes
  set status = 'consultoria_realizada'
  where status = 'em_atendimento';

commit;
