-- =====================================================================
-- DISNEY EXPERT · Dados de DEMONSTRAÇÃO para o dashboard de BI
-- APENAS para ambiente local/demo. NÃO rodar em produção.
--
-- Remover tudo depois:
--   delete from solicitacoes where codigo_agente_informado = 'SEED-DEMO';
--   delete from agentes  where id::text like 'b0000000-%';
--   delete from agencias where id::text like 'a0000000-%';
--   delete from usuarios where id::text like 'c0000000-%';
-- =====================================================================

begin;

-- Agências demo -------------------------------------------------------
insert into agencias (id, nome, cidade, uf, tier, sla_horas) values
  ('a0000000-0000-0000-0000-000000000001','Mundo Mágico Viagens','São Paulo','SP','select',24),
  ('a0000000-0000-0000-0000-000000000002','Sonho Disney Turismo','Rio de Janeiro','RJ','padrao',48),
  ('a0000000-0000-0000-0000-000000000003','Estrela Viagens','Belo Horizonte','MG','padrao',48),
  ('a0000000-0000-0000-0000-000000000004','Férias Kids Tour','Curitiba','PR','select',24),
  ('a0000000-0000-0000-0000-000000000005','Aventura Orlando','Salvador','BA','padrao',48)
on conflict (id) do nothing;

-- Agentes demo (um por agência) --------------------------------------
insert into agentes (id, agencia_id, codigo, nome, email) values
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','DEMO001','Rafael Mendes','rafael@mundomagico.com.br'),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','DEMO002','Beatriz Lima','beatriz@sonhodisney.com.br'),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','DEMO003','Carlos Souza','carlos@estrelaviagens.com.br'),
  ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000004','DEMO004','Fernanda Alves','fernanda@feriaskids.com.br'),
  ('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000005','DEMO005','Diego Martins','diego@aventuraorlando.com.br')
on conflict (id) do nothing;

-- Consultoras demo ----------------------------------------------------
insert into usuarios (id, nome, email, papel) values
  ('c0000000-0000-0000-0000-000000000001','Juliana Prado','juliana@cativa.tur.br','especialista'),
  ('c0000000-0000-0000-0000-000000000002','Marina Reis','marinareis@cativa.tur.br','especialista'),
  ('c0000000-0000-0000-0000-000000000003','Patrícia Gomes','patricia@cativa.tur.br','especialista')
on conflict (id) do nothing;

-- Solicitações demo ---------------------------------------------------
with base as (
  select
    i,
    (timestamptz '2026-02-16 09:00:00-03' + make_interval(days => i * 4, hours => (i * 5) % 12)) as criado_em,
    (case (i % 10)
       when 0 then 'venda_finalizada' when 1 then 'venda_finalizada' when 2 then 'venda_finalizada'
       when 3 then 'venda_perdida'
       when 4 then 'consultoria_realizada' when 5 then 'consultoria_realizada' when 6 then 'consultoria_realizada'
       else 'nova_solicitacao' end) as status
  from generate_series(1, 40) i
),
comp as (
  select b.*,
    case when b.status <> 'nova_solicitacao'
         then b.criado_em + make_interval(hours => (b.i % 30) + 4) end as pat,
    (2 + (b.i % 4)) as adultos,
    (b.i % 3) as criancas,
    (array['São Paulo - SP','Rio de Janeiro - RJ','Belo Horizonte - MG','Curitiba - PR','Porto Alegre - RS','Salvador - BA'])[(b.i % 6) + 1] as cidade,
    (array['Hotel','Casa de temporada com piscina','Apartamento ou condo-hotel','Quero comparar as opções'])[(b.i % 4) + 1] as estilo,
    (array['Econômico, o essencial bem resolvido','Intermediário, mais conforto e estrutura','Luxo, experiência completa','Quero comparar as categorias'])[(b.i % 4) + 1] as perfil,
    (array['Sim, tenho interesse','Não, prefiro ficar fora','Quero comparar as duas possibilidades'])[(b.i % 3) + 1] as complexo,
    (array['Carro alugado','Transfer contratado','Aplicativo, como Uber','Transporte do hotel','Ainda não sei'])[(b.i % 5) + 1] as locom,
    (array['Sim, é a primeira vez','Já fomos uma vez','Já fomos mais de uma vez'])[(b.i % 3) + 1] as primeira_txt,
    (case (b.i % 4)
       when 0 then array['Magic Kingdom','EPCOT']
       when 1 then array['Magic Kingdom','Universal Studios','Epic Universe']
       when 2 then array['Disney’s Hollywood Studios','Islands of Adventure']
       else array['Magic Kingdom','Disney’s Animal Kingdom','EPCOT'] end) as pq
  from base b
)
insert into solicitacoes (
  agente_id, agencia_id, codigo_agente_informado,
  cliente_nome, cliente_email, cliente_whatsapp,
  total_pessoas, total_criancas, primeira_viagem,
  data_prevista, data_prevista_texto, origem_embarque,
  dias_orlando, dias_parques, parques,
  respostas, status, responsavel_id,
  primeiro_atendimento_em, venda_em, valor_total_venda, motivo_perda,
  consentimento_lgpd, consentimento_em, criado_em
)
select
  (array['b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000005'])[(i % 5) + 1]::uuid,
  (array['a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000005'])[(i % 5) + 1]::uuid,
  'SEED-DEMO',
  'Cliente Demo ' || i,
  'demo' || i || '@exemplo.com',
  '5199' || lpad(i::text, 6, '0'),
  adultos + criancas, criancas, (i % 3 = 0),
  (date '2027-01-10' + (i * 3)), to_char(date '2027-01-10' + (i * 3), 'DD/MM/YYYY'), cidade,
  (array[7,8,11,15])[(i % 4) + 1], (array[4,5,8,11])[(i % 4) + 1], pq,
  jsonb_build_object(
    'quantos_adultos', adultos::text,
    'quantas_criancas', criancas::text,
    'primeira_viagem', primeira_txt,
    'estilo_hospedagem', estilo,
    'perfil_hotel', perfil,
    'hoteis_dentro_complexo', complexo,
    'locomocao', locom,
    'origem_embarque', cidade,
    'parques', to_jsonb(pq)
  ),
  status::status_solicitacao,
  case when status <> 'nova_solicitacao'
       then (array['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003'])[(i % 3) + 1]::uuid end,
  pat,
  case when status = 'venda_finalizada' then pat + make_interval(days => (i % 12) + 1, hours => (i % 8)) end,
  case when status = 'venda_finalizada' then (8000 + (i % 20) * 800)::numeric end,
  case when status = 'venda_perdida'
       then (array['sem_retorno_agencia','cliente_desistiu','perdido_concorrencia','fora_de_perfil'])[(i % 4) + 1]::motivo_perda end,
  true, criado_em, criado_em
from comp;

commit;
