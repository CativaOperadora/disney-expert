-- =====================================================================
-- DISNEY EXPERT · Migração 012
-- Seguidores do ticket, central de notificações e anotações da agência.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_012_seguidores_notificacoes.sql
--
-- Reexecução é segura.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. SEGUIDORES
--
-- Um agente convida colegas DA MESMA AGÊNCIA para acompanhar uma
-- negociação. Seguir dá acesso de leitura ao ticket e faz chegar as
-- notificações dele.
--
-- A restrição de mesma agência NÃO fica só na interface: é conferida na
-- gravação (lib/seguidores.ts) contra a agência da solicitação. Um id de
-- outra organização simplesmente não entra.
-- ---------------------------------------------------------------------
create table if not exists seguidores (
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  agente_id      uuid not null references agentes(id)      on delete cascade,
  criado_por     uuid references agentes(id)               on delete set null,
  criado_em      timestamptz not null default now(),
  primary key (solicitacao_id, agente_id)
);

comment on table seguidores is
  'Agentes que acompanham uma solicitação sem serem o dono dela. Sempre da mesma agência. Seguir concede leitura do ticket e entrega as notificações dele.';

create index if not exists seguidores_agente_idx on seguidores (agente_id);

-- ---------------------------------------------------------------------
-- 2. NOTIFICAÇÕES
--
-- Uma linha por DESTINATÁRIO, não por evento: o mesmo fato gera várias
-- notificações, uma para cada pessoa que precisa saber. É o que permite
-- "lida" ser individual — o admin marcar como lida não pode apagar o
-- aviso do agente.
--
-- Só existem notificações para usuários do PORTAL. A equipe interna ainda
-- entra com senha compartilhada, então não há a quem endereçar; isso
-- muda quando o login individual chegar (Fase 4).
--
-- FRONTEIRA: nenhum evento do lado consultoria gera notificação aqui.
-- Avisar a agência de que a especialista mudou de etapa vazaria o
-- andamento interno pela porta dos fundos.
-- ---------------------------------------------------------------------
create table if not exists notificacoes (
  id             bigserial primary key,
  destinatario_id uuid not null references agentes(id) on delete cascade,
  solicitacao_id uuid references solicitacoes(id) on delete cascade,
  tipo           text not null,
  titulo         text not null,
  descricao      text,
  lida_em        timestamptz,
  criado_em      timestamptz not null default now()
);

comment on table notificacoes is
  'Central de notificações do Portal. Uma linha por destinatário. Nenhum evento do CRM interno chega aqui: isso exporia o andamento da consultoria.';
comment on column notificacoes.tipo is
  'Valores convencionados: solicitacao_nova, card_movido, seguidor_adicionado, venda_finalizada, nota_agencia.';
comment on column notificacoes.lida_em is
  'Nulo enquanto não lida. É o que alimenta o contador de não lidas.';

-- Consulta principal: as não lidas de uma pessoa, mais recentes primeiro.
create index if not exists notificacoes_caixa_idx
  on notificacoes (destinatario_id, criado_em desc);
create index if not exists notificacoes_nao_lidas_idx
  on notificacoes (destinatario_id) where lida_em is null;

commit;

-- Conferência.
select
  (select count(*) from information_schema.tables where table_name='seguidores')   as tabela_seguidores,
  (select count(*) from information_schema.tables where table_name='notificacoes') as tabela_notificacoes;
