-- =====================================================================
-- DISNEY EXPERT · Migração 008
-- Consentimento de marketing e base da aba "Leads" do Portal.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_008_leads_marketing.sql
--
-- POR QUE UMA COLUNA SEPARADA
--   `consentimento_lgpd` é o aceite OBRIGATÓRIO, de finalidade específica:
--   "uso destes dados para a elaboração da minha proposta de viagem".
--   Campanha de e-mail é outra finalidade e, pela LGPD (art. 6º, I —
--   princípio da finalidade), exige consentimento próprio. Misturar os dois
--   na mesma coluna destruiria a prova de qual finalidade foi aceita.
--
--   Por isso `aceite_marketing` nasce como opt-in separado, opcional e
--   desmarcado por padrão. Registros anteriores à migração ficam false —
--   é o padrão correto: quem nunca foi perguntado não consentiu.
-- =====================================================================

begin;

alter table solicitacoes
  add column if not exists aceite_marketing    boolean not null default false,
  add column if not exists aceite_marketing_em timestamptz;

comment on column solicitacoes.aceite_marketing is
  'Opt-in OPCIONAL para receber ofertas e novidades da agência. Distinto de consentimento_lgpd, que é o aceite obrigatório restrito à elaboração da proposta. Só quem tem true aqui pode entrar em campanha de e-mail.';
comment on column solicitacoes.aceite_marketing_em is
  'Momento do opt-in de marketing. É a prova temporal do consentimento exigida pela LGPD.';

-- A aba Leads filtra por agência e, com frequência, só por quem aceitou
-- campanha. Índice parcial: indexa apenas as linhas que interessam.
create index if not exists solicitacoes_marketing_idx
  on solicitacoes (agencia_id, cliente_email)
  where aceite_marketing;

-- Agrupamento de leads por pessoa dentro da agência/agente.
create index if not exists solicitacoes_lead_agencia_idx
  on solicitacoes (agencia_id, cliente_email);
create index if not exists solicitacoes_lead_agente_idx
  on solicitacoes (agente_id, cliente_email);

commit;
