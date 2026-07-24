-- =====================================================================
-- DISNEY EXPERT · Migração 005
-- Autenticação do Portal do Agente (multi-tenant por agência).
--
-- Rodar:
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_005_portal_agentes.sql
--
-- A tabela `agentes` passa a ser também a tabela de usuários do Portal.
-- Cada agente pertence a uma agência (organização) por `agencia_id`; o
-- flag `admin` distingue o Administrador da Agência do Agente comum.
-- =====================================================================

begin;

alter table agentes
  add column if not exists senha_hash    text,
  add column if not exists admin         boolean not null default false,
  add column if not exists ultimo_acesso timestamptz;

comment on column agentes.senha_hash is
  'Hash bcrypt da senha do Portal (pgcrypto: crypt/gen_salt). Nulo = ainda sem acesso ao Portal.';
comment on column agentes.admin is
  'true = Administrador da Agência: enxerga todas as solicitações da própria organização e gerencia usuários. false = Agente: enxerga apenas as próprias.';

-- Índice para o login por e-mail (case-insensitive já pelo tipo citext).
create index if not exists agentes_login_idx on agentes (email) where ativo;

commit;
