-- =====================================================================
-- DISNEY EXPERT · Migração 006
-- Reestruturação do Kanban: consultoria por especialista + Concluídas.
--
--   - Novo status 'concluida' (coluna Concluídas, encerramento automático).
--   - status_em: momento da última mudança de status (base da automação).
--   - Consultoras do Kanban: Juliana e Bighetti (as demais desativadas).
-- =====================================================================

-- ALTER TYPE ADD VALUE não pode rodar dentro de transação: fica solto.
alter type status_solicitacao add value if not exists 'concluida';

begin;

alter table solicitacoes add column if not exists status_em timestamptz;
comment on column solicitacoes.status_em is
  'Momento da última mudança de status. Base da automação de encerramento (2 dias em Venda Finalizada/Perdida → Concluídas).';
update solicitacoes
  set status_em = coalesce(venda_em, atualizado_em, criado_em)
  where status_em is null;

-- Consultoras ativas do Kanban: apenas Juliana e Bighetti.
update usuarios set nome = 'Juliana Bertolini'
  where id = 'c0000000-0000-0000-0000-000000000001';
insert into usuarios (id, nome, email, papel) values
  ('c0000000-0000-0000-0000-000000000004', 'Biguetti', 'atendimentosp1@cativaoperadora.com.br', 'especialista')
on conflict (id) do nothing;
update usuarios set ativo = false
  where papel = 'especialista'
    and id not in (
      'c0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000004');

-- Reatribui as solicitações em consultoria entre as duas consultoras ativas
-- (metade para cada), para nenhuma ficar sem coluna.
with num as (
  select id, row_number() over (order by criado_em) rn
  from solicitacoes where status = 'consultoria_realizada'
)
update solicitacoes s
  set responsavel_id = case when num.rn % 2 = 0
        then 'c0000000-0000-0000-0000-000000000001'::uuid
        else 'c0000000-0000-0000-0000-000000000004'::uuid end
  from num where num.id = s.id;

commit;
