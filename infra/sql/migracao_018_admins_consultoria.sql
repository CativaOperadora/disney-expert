-- =====================================================================
-- DISNEY EXPERT · Migração 018
-- Dois acessos administrativos ao CRM da consultoria.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_018_admins_consultoria.sql
--
--     supervisaomarketing@cativaoperadora.com.br
--     gerenteatendimento@cativaoperadora.com.br
--
-- ⚠️  SENHA TEMPORÁRIA:  Cativa@2026
--     Atende à regra (8+ caracteres, 1 especial) e está em texto claro
--     neste arquivo, que vive no repositório. Trocar no primeiro acesso,
--     em "Editar meu perfil".
--
-- O QUE papel='admin' SIGNIFICA AQUI
--   O acesso ao CRM não depende do papel: app/painel/layout.tsx exige
--   apenas sessão válida. Então estes dois enxergam tudo — fila, quadro,
--   fichas, dashboards e o cadastro de agências.
--
--   O papel decide o que NÃO vem junto. Três lugares filtram
--   papel='especialista', e por isso um admin:
--
--     · não ganha coluna própria no Kanban  (app/painel/page.tsx)
--     · não recebe o e-mail de solicitação nova
--       (app/api/solicitacoes/route.ts)
--     · não recebe o aviso no sino do CRM
--       (notificarEspecialistas, em lib/notificacoes.ts)
--
--   É o comportamento desejado para supervisão e gerência: acompanham a
--   operação inteira sem entrar no rodízio de atendimento. Para incluí-los
--   nos avisos depois, basta trocar o filtro daqueles três pontos por
--   papel in ('especialista','admin') — nenhuma mudança de esquema.
--
-- Reexecução é segura: identifica pelo id fixo e não reseta senha de quem
-- já trocou a sua.
-- =====================================================================

begin;

insert into usuarios (id, nome, email, papel, ativo) values
  ('c0000000-0000-0000-0000-000000000010',
   'Supervisão de Marketing',
   'supervisaomarketing@cativaoperadora.com.br',
   'admin', true),
  ('c0000000-0000-0000-0000-000000000011',
   'Gerência de Atendimento',
   'gerenteatendimento@cativaoperadora.com.br',
   'admin', true)
on conflict (id) do nothing;

-- Reativa e garante o endereço, caso alguém tenha desativado antes.
update usuarios set ativo = true, papel = 'admin'
 where id in ('c0000000-0000-0000-0000-000000000010',
              'c0000000-0000-0000-0000-000000000011');

-- Só define senha para quem ainda não tem: reexecutar NÃO reseta a senha
-- de quem já trocou a temporária.
update usuarios
   set senha_hash = crypt('Cativa@2026', gen_salt('bf'))
 where id in ('c0000000-0000-0000-0000-000000000010',
              'c0000000-0000-0000-0000-000000000011')
   and senha_hash is null;

commit;

-- Conferência.
select nome, email, papel, ativo, (senha_hash is not null) as tem_senha
from usuarios order by papel, nome;
