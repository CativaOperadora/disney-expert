-- =====================================================================
-- DISNEY EXPERT · Migração 007
-- Mantém apenas as consultoras reais (Juliana e Bighetti), removendo os
-- cadastros fictícios de demonstração (Marina, Patrícia, Especialista…).
--
-- Roda depois da 006. Antes de remover, reatribui os cards dessas
-- consultoras entre Juliana e Bighetti, para nenhum ficar sem consultora.
-- =====================================================================

begin;

-- Garante que Juliana e Bighetti existem (idempotente com a 006).
update usuarios set nome = 'Juliana Bertolini', ativo = true
  where id = 'c0000000-0000-0000-0000-000000000001';
insert into usuarios (id, nome, email, papel) values
  ('c0000000-0000-0000-0000-000000000004', 'Biguetti', 'atendimentosp1@cativaoperadora.com.br', 'especialista')
on conflict (id) do nothing;
update usuarios set ativo = true where id = 'c0000000-0000-0000-0000-000000000004';

-- Reatribui TODOS os cards das outras consultoras entre Juliana e Bighetti.
with alvo as (
  select id, row_number() over (order by criado_em) rn
  from solicitacoes
  where responsavel_id is not null
    and responsavel_id not in (
      'c0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000004')
)
update solicitacoes s
  set responsavel_id = case when alvo.rn % 2 = 0
        then 'c0000000-0000-0000-0000-000000000001'::uuid
        else 'c0000000-0000-0000-0000-000000000004'::uuid end
  from alvo where alvo.id = s.id;

-- Remove as consultoras fictícias (qualquer especialista que não seja as duas).
delete from usuarios
  where papel = 'especialista'
    and id not in (
      'c0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000004');

commit;
