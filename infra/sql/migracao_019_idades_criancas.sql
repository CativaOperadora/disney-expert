-- =====================================================================
-- DISNEY EXPERT · Migração 019
-- Idade de cada criança na data da viagem.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_019_idades_criancas.sql
--
-- O formulário passa a pedir a idade EXATA de cada criança, e não só a
-- quantidade. É a informação que define o valor do ingresso: os parques
-- cobram pela idade no dia da visita, e uma viagem daqui a um ano muda a
-- faixa de quem está perto do aniversário.
--
-- A coluna já estava prevista na seção "MIGRAÇÃO FUTURA" do schema base.
-- As demais daquela lista (total_adultos, faixas de idade separadas) NÃO
-- entram aqui: o formulário ainda não as coleta, e coluna sem origem só
-- confunde quem lê o banco depois.
--
-- Registros anteriores ficam com NULL — nunca informaram idade, e NULL
-- diz exatamente isso. Array vazio significaria "informou nenhuma", que
-- é outra coisa.
--
-- Reexecução é segura.
-- =====================================================================

begin;

alter table solicitacoes
  add column if not exists idades_criancas smallint[];

comment on column solicitacoes.idades_criancas is
  'Idade que cada criança terá NA DATA DA VIAGEM, uma posição por criança. A ordem acompanha os campos do formulário. NULL em registros anteriores à versão 5 do formulário.';

commit;

-- Conferência.
select
  (select count(*) from information_schema.columns
    where table_name = 'solicitacoes' and column_name = 'idades_criancas') as coluna_criada,
  (select count(*) from solicitacoes where idades_criancas is not null) as ja_preenchidas;
