-- =====================================================================
-- DISNEY EXPERT · Esquema do banco de dados
-- PostgreSQL 14+ (testado para Supabase e Neon)
-- Versão 1 · formulário conforme perguntas atuais
-- =====================================================================
--
-- COMO RODAR
--   psql "$DATABASE_URL" -f schema_disney_expert.sql
--   ou colar no SQL Editor do Supabase e executar
--
-- PRINCÍPIO DE DESENHO
--   A coluna solicitacoes.respostas guarda o envio bruto e completo do
--   formulário, e nunca é alterada. As colunas nomeadas ao lado dela são
--   uma projeção consultável, escritas pela aplicação no momento do
--   insert, a partir do mesmo payload.
--   Perguntas novas entram apenas no JSONB. Só viram coluna quando
--   passarem a ser usadas em filtro, ordenação ou relatório.
--
-- NOTA DE MIGRAÇÃO PLANEJADA
--   O formulário atual define criança como 0 a 8 anos. Os parques cobram
--   por outra régua: adulto a partir de 10 anos, criança de 3 a 9 anos e
--   isento abaixo de 3. Quando ajustar o formulário, as colunas
--   total_adultos, total_criancas_3_9 e total_bebes_0_2 já estão
--   previstas no fim do arquivo, prontas para serem habilitadas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- e-mail sem diferenciar maiúsculas
create extension if not exists pg_trgm;    -- busca por nome aproximado


-- ---------------------------------------------------------------------
-- 2. TIPOS
-- Para acrescentar um valor depois:
--   alter type status_solicitacao add value 'novo_valor';
-- ---------------------------------------------------------------------
create type tier_agencia       as enum ('padrao', 'select');
create type papel_usuario      as enum ('especialista', 'supervisor', 'admin');

create type status_solicitacao as enum (
  'novo',                 -- acabou de chegar, ninguém olhou
  'triagem',              -- agente não identificado ou e-mail não entregue
  'em_analise',           -- especialista estudando o briefing
  'consultoria_entregue', -- orientação enviada à agência
  'com_agencia',          -- agência montando ou negociando a proposta
  'follow_up',            -- aguardando retorno
  'ganho',                -- reserva confirmada
  'perdido',
  'duplicada'
);

create type motivo_perda as enum (
  'sem_retorno_agencia',
  'cliente_desistiu',
  'perdido_concorrencia',
  'fora_de_perfil'
);

create type perfil_solicitacao as enum (
  'indefinido',
  'primeira_viagem_familia',
  'primeira_viagem_adultos',
  'retorno',
  'comemoracao',
  'alto_padrao'
);

create type tipo_envio as enum (
  'briefing_agente',
  'confirmacao_cliente',
  'copia_especialista',
  'reenvio_briefing'
);

create type status_envio as enum (
  'pendente', 'enviado', 'entregue', 'aberto', 'bounce', 'spam', 'falha'
);


-- ---------------------------------------------------------------------
-- 3. PROTOCOLO
-- Identificador legível, usado ao telefone com a agência: DSN-2026-0417
-- A sequência não reinicia por ano, o que mantém a unicidade global.
-- ---------------------------------------------------------------------
create sequence protocolo_seq start 1;

create or replace function gerar_protocolo() returns text
language sql volatile as $$
  select 'DSN-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('protocolo_seq')::text, 4, '0');
$$;


-- ---------------------------------------------------------------------
-- 4. CADASTRO
-- ---------------------------------------------------------------------
create table agencias (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cnpj          text unique,
  cidade        text,
  uf            char(2),
  tier          tier_agencia not null default 'padrao',
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column agencias.tier is
  'Alimenta o score de prioridade. Agências Select entram na frente da fila.';


create table agentes (
  id            uuid primary key default gen_random_uuid(),
  agencia_id    uuid not null references agencias(id) on delete restrict,
  codigo        text not null unique,
  nome          text not null,
  email         citext not null,
  telefone      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column agentes.codigo is
  'Identificador público usado no link: /formulario?ag=CTV8213. Nunca expõe e-mail na URL.';

-- Um mesmo e-mail não pode ter dois cadastros ativos, mas pode ter
-- histórico inativo, o que permite trocar de agência sem perder registro.
create unique index agentes_email_ativo_uniq on agentes (email) where ativo;
create index agentes_agencia_idx on agentes (agencia_id);


create table usuarios (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  email     citext not null unique,
  papel     papel_usuario not null default 'especialista',
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table usuarios is
  'Time interno da Cativa. Agentes de viagem não têm registro aqui.';


-- ---------------------------------------------------------------------
-- 5. SOLICITAÇÃO · entidade central
-- ---------------------------------------------------------------------
create table solicitacoes (
  id         uuid primary key default gen_random_uuid(),
  protocolo  text not null unique default gerar_protocolo(),

  -- origem -----------------------------------------------------------
  agente_id               uuid references agentes(id)  on delete set null,
  agencia_id              uuid references agencias(id) on delete set null,
  codigo_agente_informado text,
  origem_url              text,
  utm                     jsonb not null default '{}'::jsonb,

  -- atendimento -------------------------------------------------------
  status         status_solicitacao not null default 'novo',
  motivo_perda   motivo_perda,
  responsavel_id uuid references usuarios(id) on delete set null,
  prioridade     smallint not null default 0,
  perfil         perfil_solicitacao not null default 'indefinido',
  completude     smallint not null default 0,
  duplicada_de   uuid references solicitacoes(id) on delete set null,

  -- cliente final -----------------------------------------------------
  cliente_nome     text   not null,
  cliente_email    citext not null,
  cliente_whatsapp text   not null,

  -- projeção consultável do formulário --------------------------------
  total_pessoas       smallint,
  total_criancas      smallint,
  primeira_viagem     boolean,
  data_prevista       date,
  data_prevista_texto text,
  origem_embarque     text,
  dias_orlando        smallint,
  dias_parques        smallint,
  parques             text[],

  -- arquivo bruto -----------------------------------------------------
  respostas         jsonb not null,
  versao_formulario smallint not null default 1,

  -- LGPD --------------------------------------------------------------
  consentimento_lgpd boolean not null default false,
  consentimento_ip   inet,
  consentimento_em   timestamptz,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint chk_motivo_perda
    check ((status = 'perdido') = (motivo_perda is not null)),
  constraint chk_duplicada
    check ((status = 'duplicada') or (duplicada_de is null))
);

comment on column solicitacoes.respostas is
  'Envio bruto e integral do formulário. Arquivo imutável: nunca atualize, só leia.';
comment on column solicitacoes.total_criancas is
  'Definição atual do formulário: 0 a 8 anos. Ver nota de migração no topo do arquivo.';
comment on column solicitacoes.codigo_agente_informado is
  'Código que veio na URL, guardado mesmo quando não resolve para um agente ativo. É o que permite investigar link quebrado.';
comment on column solicitacoes.completude is
  'Percentual de campos relevantes preenchidos. Orienta a especialista sobre o que perguntar antes de orçar.';

-- índices -------------------------------------------------------------
-- consulta principal do painel: fila aberta por prioridade
create index solicitacoes_fila_idx
  on solicitacoes (prioridade desc, criado_em asc)
  where status not in ('ganho', 'perdido', 'duplicada');

create index solicitacoes_agencia_idx     on solicitacoes (agencia_id);
create index solicitacoes_agente_idx      on solicitacoes (agente_id);
create index solicitacoes_responsavel_idx on solicitacoes (responsavel_id);
create index solicitacoes_criado_idx      on solicitacoes (criado_em desc);
create index solicitacoes_data_idx        on solicitacoes (data_prevista);

-- deduplicação: mesmo cliente em janela recente
create index solicitacoes_cliente_email_idx    on solicitacoes (cliente_email);
create index solicitacoes_cliente_whatsapp_idx on solicitacoes (cliente_whatsapp);

-- busca por nome com tolerância a erro de digitação
create index solicitacoes_nome_trgm_idx
  on solicitacoes using gin (cliente_nome gin_trgm_ops);

-- consulta dentro do JSONB, para perguntas ainda não promovidas a coluna
create index solicitacoes_respostas_gin_idx
  on solicitacoes using gin (respostas);


-- ---------------------------------------------------------------------
-- 6. EVENTOS · linha do tempo, auditoria e rastro LGPD
-- Tabela somente-inserção. Toda mudança vira registro novo.
-- ---------------------------------------------------------------------
create table eventos (
  id             bigserial primary key,
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  tipo           text not null,
  autor_id       uuid references usuarios(id) on delete set null,
  descricao      text,
  payload        jsonb not null default '{}'::jsonb,
  criado_em      timestamptz not null default now()
);

comment on column eventos.autor_id is
  'Nulo quando a ação foi do sistema, preenchido quando foi de uma pessoa.';
comment on column eventos.tipo is
  'Texto livre por opção: a lista cresce durante o desenvolvimento. Valores convencionados: criada, email_disparado, email_entregue, email_aberto, email_bounce, status_alterado, responsavel_alterado, comentario, consultoria_registrada, duplicidade_detectada.';

create index eventos_solicitacao_idx on eventos (solicitacao_id, criado_em desc);
create index eventos_tipo_idx        on eventos (tipo);


-- ---------------------------------------------------------------------
-- 7. ENVIOS DE E-MAIL
-- O índice único em idempotency_key torna o envio duplicado
-- estruturalmente impossível, e não uma checagem que alguém pode esquecer.
-- Chave sugerida: solicitacao_id || ':' || tipo
-- ---------------------------------------------------------------------
create table envios_email (
  id                  uuid primary key default gen_random_uuid(),
  solicitacao_id      uuid not null references solicitacoes(id) on delete cascade,
  tipo                tipo_envio not null,
  destinatario        citext not null,
  assunto             text,
  idempotency_key     text not null unique,
  status              status_envio not null default 'pendente',
  tentativas          smallint not null default 0,
  provider            text,
  provider_message_id text,
  erro                text,
  criado_em           timestamptz not null default now(),
  enviado_em          timestamptz,
  atualizado_em       timestamptz
);

comment on column envios_email.idempotency_key is
  'Insira esta linha ANTES de chamar o provedor. Se o insert falhar por violação de unicidade, o envio já aconteceu: não envie de novo.';

create index envios_solicitacao_idx on envios_email (solicitacao_id);
create index envios_provider_msg_idx on envios_email (provider_message_id);
create index envios_pendentes_idx on envios_email (criado_em)
  where status in ('pendente', 'falha');


-- ---------------------------------------------------------------------
-- 8. GATILHOS
-- ---------------------------------------------------------------------
create or replace function tocar_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger agencias_touch     before update on agencias
  for each row execute function tocar_atualizado_em();
create trigger agentes_touch      before update on agentes
  for each row execute function tocar_atualizado_em();
create trigger solicitacoes_touch before update on solicitacoes
  for each row execute function tocar_atualizado_em();
create trigger envios_touch       before update on envios_email
  for each row execute function tocar_atualizado_em();

-- Protege a integridade da auditoria: eventos não se alteram.
create or replace function bloquear_update_eventos() returns trigger
language plpgsql as $$
begin
  raise exception 'A tabela eventos é somente-inserção. Registre um evento novo em vez de alterar o existente.';
end;
$$;

create trigger eventos_imutaveis before update on eventos
  for each row execute function bloquear_update_eventos();


-- ---------------------------------------------------------------------
-- 9. VISÃO · tela principal da especialista em uma consulta
-- ---------------------------------------------------------------------
create view fila_atendimento as
select
  s.id,
  s.protocolo,
  s.status,
  s.prioridade,
  s.perfil,
  s.completude,
  s.cliente_nome,
  s.cliente_whatsapp,
  s.data_prevista,
  s.total_pessoas,
  s.total_criancas,
  s.primeira_viagem,
  s.dias_orlando,
  s.dias_parques,
  ag.nome  as agencia_nome,
  ag.tier  as agencia_tier,
  a.nome   as agente_nome,
  a.email  as agente_email,
  u.nome   as responsavel_nome,
  s.criado_em,
  (now() - s.criado_em) as tempo_em_fila
from solicitacoes s
left join agentes  a  on a.id  = s.agente_id
left join agencias ag on ag.id = s.agencia_id
left join usuarios u  on u.id  = s.responsavel_id
where s.status not in ('ganho', 'perdido', 'duplicada')
order by s.prioridade desc, s.criado_em asc;


-- ---------------------------------------------------------------------
-- 10. DADOS DE EXEMPLO · remover antes de ir para produção
-- ---------------------------------------------------------------------
insert into agencias (id, nome, cidade, uf, tier) values
  ('11111111-1111-1111-1111-111111111111', 'Turismo Silva', 'Porto Alegre', 'RS', 'select');

insert into agentes (agencia_id, codigo, nome, email, telefone) values
  ('11111111-1111-1111-1111-111111111111', 'CTV8213',
   'Cláudia Ramos', 'claudia@turismosilva.com.br', '51999990000');

-- Consultoras reais da Cativa (as duas colunas de consultoria do Kanban).
insert into usuarios (id, nome, email, papel) values
  ('c0000000-0000-0000-0000-000000000001', 'Juliana',  'atendimentosp7@cativaoperadora.com.br',  'especialista'),
  ('c0000000-0000-0000-0000-000000000004', 'Bighetti', 'atendimentosp1@cativaoperadora.com.br', 'especialista');

insert into solicitacoes (
  agente_id, agencia_id, codigo_agente_informado,
  cliente_nome, cliente_email, cliente_whatsapp,
  total_pessoas, total_criancas, primeira_viagem,
  data_prevista, data_prevista_texto, origem_embarque,
  dias_orlando, dias_parques, parques,
  consentimento_lgpd, consentimento_em,
  respostas
)
select
  a.id, a.agencia_id, 'CTV8213',
  'Marina Costa', 'marina@exemplo.com.br', '51988887777',
  4, 2, true,
  '2027-07-15', 'Julho de 2027', 'Porto Alegre (POA)',
  10, 7, array['Magic Kingdom', 'EPCOT', 'Epic Universe'],
  true, now(),
  jsonb_build_object(
    'nome_completo',         'Marina Costa',
    'email',                 'marina@exemplo.com.br',
    'whatsapp',              '51988887777',
    'quantas_pessoas',       4,
    'quantas_criancas',      2,
    'primeira_viagem',       true,
    'data_prevista',         'Julho de 2027',
    'origem_embarque',       'Porto Alegre (POA)',
    'dias_orlando',          10,
    'dias_parques',          7,
    'estilo_hospedagem',     'Hotel',
    'perfil_hotel',          'Intermediário',
    'hoteis_dentro_complexo','Sim, tenho interesse',
    'parques',               jsonb_build_array('Magic Kingdom', 'EPCOT', 'Epic Universe'),
    'locomocao',             'Carro alugado'
  )
from agentes a where a.codigo = 'CTV8213';


-- ---------------------------------------------------------------------
-- 11. MIGRAÇÃO FUTURA · habilitar quando o formulário separar as idades
-- ---------------------------------------------------------------------
-- alter table solicitacoes
--   add column total_adultos       smallint,  -- 10 anos ou mais
--   add column total_criancas_3_9  smallint,  -- pagam ingresso infantil
--   add column total_bebes_0_2     smallint,  -- isentos
--   add column idades_criancas     smallint[],
--   add column orcamento_faixa     text,
--   add column nivel_decisao       text,
--   add column aereo_incluso       boolean;
--
-- create index solicitacoes_orcamento_idx on solicitacoes (orcamento_faixa);


-- ---------------------------------------------------------------------
-- 12. SEGURANÇA NO SUPABASE
-- ---------------------------------------------------------------------
-- Se usar Supabase, habilite RLS em todas as tabelas e não permita acesso
-- direto do navegador. O formulário público deve gravar sempre pela API
-- da aplicação, com a service role key guardada no servidor.
--
--   alter table solicitacoes enable row level security;
--   alter table eventos      enable row level security;
--   alter table envios_email enable row level security;
--   alter table agentes      enable row level security;
--   alter table agencias     enable row level security;
--
-- Depois crie políticas de leitura para usuários autenticados do time
-- interno. Nenhuma política de escrita deve existir para o papel anon.
