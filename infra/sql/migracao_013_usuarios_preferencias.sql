-- =====================================================================
-- DISNEY EXPERT · Migração 013
-- Login individual da equipe Cativa e preferências de usuário.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_013_usuarios_preferencias.sql
--
-- Reexecução é segura.
--
-- ⚠️  SENHA TEMPORÁRIA
--   As especialistas existentes recebem a senha inicial  Cativa@2026
--   Ela atende à regra (8+ caracteres, 1 especial) e serve só para o
--   primeiro acesso. TROQUE em Preferências no primeiro login — está
--   escrita em texto claro neste arquivo, que vive no repositório.
--
-- POR QUE O LOGIN MUDA
--   O CRM interno usava UMA senha compartilhada (PAINEL_SENHA). Isso
--   impede qualquer coisa por pessoa: preferências, notificações e
--   auditoria de quem fez o quê. A tabela `usuarios` já existia com o
--   time; agora ela ganha credencial própria.
--
--   PAINEL_SENHA continua funcionando como acesso de emergência enquanto
--   a transição acontece — ver lib/auth.ts. Remova do .env depois que
--   todos tiverem senha pessoal.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Credencial individual do time interno
-- ---------------------------------------------------------------------
alter table usuarios
  add column if not exists senha_hash    text,
  add column if not exists ultimo_acesso timestamptz;

comment on column usuarios.senha_hash is
  'Hash bcrypt (pgcrypto). Nulo = ainda sem acesso individual ao CRM.';

create index if not exists usuarios_login_idx on usuarios (email) where ativo;

-- ---------------------------------------------------------------------
-- 2. Preferências
--
-- As mesmas colunas nas DUAS tabelas de usuário: `usuarios` é o time
-- interno, `agentes` é o pessoal das agências. Preferência é da pessoa,
-- então cada uma carrega a sua.
--
-- `idioma` entra já preparada, mas sem seletor na interface: hoje só
-- existe pt-BR e as ~150 strings ainda estão no código. Um seletor com
-- uma opção só passaria impressão de recurso quebrado.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['usuarios', 'agentes'] loop
    execute format('alter table %I
      add column if not exists foto       text,
      add column if not exists tema       text not null default ''sistema'',
      add column if not exists celebracao boolean not null default true,
      add column if not exists idioma     text not null default ''pt-BR''', t);

    execute format('alter table %I drop constraint if exists %I', t, 'chk_tema_' || t);
    execute format('alter table %I add constraint %I check (tema in (''claro'', ''escuro'', ''sistema''))',
                   t, 'chk_tema_' || t);
  end loop;
end $$;

comment on column usuarios.foto is
  'Nome do arquivo da foto no volume de anexos. Gerado pelo servidor, nunca vindo do nome enviado.';
comment on column usuarios.tema is
  'claro | escuro | sistema. "sistema" segue a preferência do sistema operacional.';
comment on column usuarios.celebracao is
  'Liga a animação de comemoração ao concluir uma venda.';

-- ---------------------------------------------------------------------
-- 3. Senha inicial para quem já existe
--
-- Só preenche quem está sem senha: reexecutar NÃO reseta a senha de
-- ninguém que já trocou a dela.
-- ---------------------------------------------------------------------
update usuarios
   set senha_hash = crypt('Cativa@2026', gen_salt('bf'))
 where senha_hash is null and ativo;

commit;

-- Conferência.
select nome, email, ativo, (senha_hash is not null) as tem_senha, tema, celebracao
from usuarios order by nome;
