-- =====================================================================
-- DISNEY EXPERT · Seed de DEMONSTRAÇÃO do Portal (local/demo apenas)
--
-- Credenciais de teste (senha: agente123):
--   ADMIN da agência Mundo Mágico ... rafael@mundomagico.com.br
--   AGENTE da mesma agência ......... larissa@mundomagico.com.br
--   AGENTE (dados reais) ............ claudia@turismosilva.com.br
--
-- Limpeza: o agente extra é 'b0000000-...0006'; senhas ficam em senha_hash.
-- =====================================================================

begin;

-- Agente extra na agência Mundo Mágico, para demonstrar admin vendo mais
-- de um agente enquanto o agente vê só o seu.
insert into agentes (id, agencia_id, codigo, nome, email) values
  ('b0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','DEMO006','Larissa Rocha','larissa@mundomagico.com.br')
on conflict (id) do nothing;

-- Senha padrão de teste para todos os agentes demo + a agente real Cláudia.
update agentes set senha_hash = crypt('agente123', gen_salt('bf'))
  where id::text like 'b0000000-%' or codigo = 'CTV8213';

-- Rafael é o Administrador da agência Mundo Mágico.
update agentes set admin = true where id = 'b0000000-0000-0000-0000-000000000001';

-- Metade das solicitações da Mundo Mágico passam para a Larissa, para o
-- admin ver duas origens e cada agente ver só a sua.
update solicitacoes set agente_id = 'b0000000-0000-0000-0000-000000000006'
where codigo_agente_informado = 'SEED-DEMO'
  and agencia_id = 'a0000000-0000-0000-0000-000000000001'
  and split_part(cliente_nome, ' ', 3)::int % 2 = 0;

commit;
