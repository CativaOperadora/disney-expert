-- =====================================================================
-- DISNEY EXPERT · Migração 009
-- Registro detalhado da Venda Perdida: motivos novos, descrição livre e
-- anexos de imagem.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_009_perda_detalhada.sql
--
-- POR QUE OS MOTIVOS ANTIGOS CONTINUAM NO ENUM
--   Os quatro valores originais (sem_retorno_agencia, cliente_desistiu,
--   perdido_concorrencia, fora_de_perfil) NÃO são removidos. Registros já
--   gravados os referenciam, e apagar um valor de enum exigiria reescrever
--   histórico — perder o motivo real de uma venda passada para acomodar
--   uma lista nova é um mau negócio.
--
--   Eles saem apenas da INTERFACE: a lista oferecida ao especialista vive
--   em lib/sla.ts (MOTIVOS_PERDA) e passa a conter só os três novos. O
--   banco continua sabendo ler o que já existe.
-- =====================================================================

-- ALTER TYPE ADD VALUE não roda dentro de transação: fica solto, antes.
alter type motivo_perda add value if not exists 'preco';
alter type motivo_perda add value if not exists 'outro_roteiro';
alter type motivo_perda add value if not exists 'demora_retorno';

begin;

-- ---------------------------------------------------------------------
-- 1. Descrição livre do motivo (opcional)
-- ---------------------------------------------------------------------
alter table solicitacoes
  add column if not exists descricao_perda text;

comment on column solicitacoes.descricao_perda is
  'Detalhamento livre escrito pela especialista ao registrar a perda. Opcional; complementa motivo_perda, que continua obrigatório.';

-- ---------------------------------------------------------------------
-- 2. Anexos
--
-- O binário NÃO fica no banco: vai para o volume de arquivos, e aqui
-- guardamos só os metadados. Assim o dump do banco não incha e o backup
-- continua rápido.
--
-- `arquivo` é o nome gerado no disco (uuid + extensão), nunca o nome que
-- o usuário enviou — nome de upload é entrada hostil e não deve virar
-- caminho de arquivo.
-- ---------------------------------------------------------------------
create table if not exists anexos (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  contexto       text not null default 'perda',
  arquivo        text not null unique,
  nome_original  text not null,
  mime           text not null,
  tamanho        integer not null,
  criado_em      timestamptz not null default now()
);

comment on table anexos is
  'Metadados dos arquivos anexados a uma solicitação. O conteúdo fica no volume de anexos (DIRETORIO_ANEXOS), não no banco.';
comment on column anexos.contexto is
  'Onde o anexo foi adicionado. Hoje só "perda" (imagens do motivo da venda perdida).';
comment on column anexos.arquivo is
  'Nome no disco, gerado pelo servidor. Nunca derivado do nome enviado pelo usuário.';

create index if not exists anexos_solicitacao_idx on anexos (solicitacao_id, criado_em);

commit;
