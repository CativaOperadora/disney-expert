-- =====================================================================
-- DISNEY EXPERT · Migração 014
-- Troca os e-mails das especialistas para os endereços corporativos.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_014_emails_especialistas.sql
--
-- ⚠️  O E-MAIL É O LOGIN
--   A partir daqui elas entram no CRM com o endereço novo. A SENHA NÃO
--   MUDA — quem já trocou a temporária continua com a sua.
--
--     juliana@cativa.tur.br   ->  atendimentosp7@cativaoperadora.com.br
--     bighetti@cativa.tur.br  ->  atendimentosp1@cativaoperadora.com.br
--
-- Reexecução é segura: identifica pelo id fixo das duas, não pelo e-mail
-- antigo, então rodar de novo depois da troca não faz nada.
-- =====================================================================

begin;

update usuarios
   set email = 'atendimentosp7@cativaoperadora.com.br'
 where id = 'c0000000-0000-0000-0000-000000000001';

update usuarios
   set email = 'atendimentosp1@cativaoperadora.com.br'
 where id = 'c0000000-0000-0000-0000-000000000004';

commit;

-- Conferência: as duas precisam aparecer com o endereço novo e com senha.
select nome, email, ativo, (senha_hash is not null) as tem_senha
from usuarios
where id in ('c0000000-0000-0000-0000-000000000001',
             'c0000000-0000-0000-0000-000000000004')
order by nome;
