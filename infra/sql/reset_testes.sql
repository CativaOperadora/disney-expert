-- =====================================================================
-- DISNEY EXPERT · Reset para a rodada de testes pré-lançamento
--
-- ⚠️  DESTRUTIVO E IRREVERSÍVEL. Apaga TODAS as solicitações, eventos,
--     e-mails, agências e agentes. Faça backup antes (infra/backup.sh).
--
-- O QUE APAGA
--   · todas as solicitações + eventos + envios de e-mail (em cascata)
--   · todas as agências e todos os agentes/usuários do Portal
--   · zera a sequência de protocolo (volta a DSN-AAAA-0001)
--
-- O QUE PRESERVA
--   · o esquema inteiro (nenhum DDL aqui)
--   · o time interno da Cativa em `usuarios` (Juliana e Bighetti)
--   · a senha do CRM interno (fica no .env, não no banco)
--
-- O QUE CRIA
--   20 agências fictícias, cada uma com 1 administrador + 2 agentes
--   (60 logins), todas sem nenhum card — o fluxo é testado do zero.
--
-- COMO RODAR (na VPS, dentro de /opt/disney-expert/infra)
--   docker compose exec -T -e PGOPTIONS="-c disney.reset=CONFIRMO" \
--     db psql -U disney -d disney_expert < sql/reset_testes.sql
--
--   Sem a variável PGOPTIONS o script aborta sem apagar nada. É a trava
--   que impede rodar isto em produção por engano.
--
-- NOTA SOBRE E-MAIL
--   Os domínios são .teste (TLD reservado, não existe na internet), então
--   nenhuma mensagem chega a uma caixa real — os envios vão falhar de
--   propósito. Para ver os e-mails de verdade durante o teste, preencha
--   EMAIL_TESTE no infra/.env: toda mensagem é redirecionada para lá.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Trava de segurança
-- ---------------------------------------------------------------------
do $$
begin
  if coalesce(current_setting('disney.reset', true), '') <> 'CONFIRMO' then
    raise exception 'Reset NAO confirmado — nada foi apagado.'
      using hint = 'Repita o comando com: -e PGOPTIONS="-c disney.reset=CONFIRMO"';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------
-- 1. Limpeza
--
-- `eventos` e `envios_email` têm ON DELETE CASCADE a partir de
-- solicitacoes, então somem junto. `agentes` referencia `agencias` com
-- ON DELETE RESTRICT — por isso os agentes saem primeiro.
-- ---------------------------------------------------------------------
delete from solicitacoes;
delete from agentes;
delete from agencias;

-- Protocolos recomeçam do 1, para a rodada de teste ficar legível.
alter sequence protocolo_seq restart with 1;

-- ---------------------------------------------------------------------
-- 2. Consultoras internas — garante que continuam ativas
-- ---------------------------------------------------------------------
insert into usuarios (id, nome, email, papel) values
  ('c0000000-0000-0000-0000-000000000001', 'Juliana',  'atendimentosp7@cativaoperadora.com.br',  'especialista'),
  ('c0000000-0000-0000-0000-000000000004', 'Bighetti', 'atendimentosp1@cativaoperadora.com.br', 'especialista')
on conflict (id) do nothing;
update usuarios set ativo = true
  where id in ('c0000000-0000-0000-0000-000000000001',
               'c0000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------------
-- 3. As 20 agências fictícias
--
-- 5 são tier 'select' (SLA de 24h) e 15 'padrao' (48h), para o teste
-- cobrir as duas faixas de prazo e a ordenação da fila.
-- ---------------------------------------------------------------------
create temp table _ag (
  n int, nome text, slug text, cidade text, uf char(2), tier text,
  admin_nome text, agente1 text, agente2 text
) on commit drop;

insert into _ag values
  ( 1,'Voe Mais Viagens',      'voemais',          'São Paulo',      'SP','select','Rafael Menezes',    'Larissa Rocha',     'Bruno Tavares'),
  ( 2,'Trilha Sul Turismo',    'trilhasul',        'Porto Alegre',   'RS','padrao','Camila Fontes',     'Diego Moraes',      'Aline Prado'),
  ( 3,'Estrela Guia Viagens',  'estrelaguia',      'Belo Horizonte', 'MG','padrao','Marcos Vieira',     'Juliana Aguiar',    'Felipe Nunes'),
  ( 4,'Mar Aberto Turismo',    'maraberto',        'Florianópolis',  'SC','select','Patrícia Lemos',    'Rodrigo Sales',     'Bianca Duarte'),
  ( 5,'Rota Norte Viagens',    'rotanorte',        'Manaus',         'AM','padrao','Anderson Lima',     'Tainá Barbosa',     'Gustavo Reis'),
  ( 6,'Céu Azul Turismo',      'ceuazul',          'Curitiba',       'PR','padrao','Renata Klein',      'Otávio Franco',     'Milena Castro'),
  ( 7,'Passaporte Dourado',    'passaportedourado','Rio de Janeiro', 'RJ','select','Leonardo Braga',    'Carolina Pinto',    'Thiago Amaral'),
  ( 8,'Bússola Viagens',       'bussola',          'Salvador',       'BA','padrao','Fernanda Cardoso',  'Ricardo Peixoto',   'Sabrina Melo'),
  ( 9,'Horizonte Turismo',     'horizonte',        'Goiânia',        'GO','padrao','Eduardo Salgado',   'Priscila Andrade',  'Vinícius Rocha'),
  (10,'Sol Nascente Viagens',  'solnascente',      'Fortaleza',      'CE','padrao','Mariana Bastos',    'Caio Ferreira',     'Denise Coelho'),
  (11,'Caminho Certo Turismo', 'caminhocerto',     'Campinas',       'SP','padrao','Paulo Sérgio Dias', 'Natália Guedes',    'Henrique Barros'),
  (12,'Alto Mar Viagens',      'altomar',          'Recife',         'PE','select','Isabela Moura',     'André Cavalcanti',  'Letícia Ramos'),
  (13,'Terra Nova Turismo',    'terranova',        'Brasília',       'DF','padrao','Roberto Anjos',     'Sílvia Marques',    'Daniel Correia'),
  (14,'Vento Leste Viagens',   'ventoleste',       'Vitória',        'ES','padrao','Cristina Sobral',   'Márcio Teixeira',   'Yasmin Lopes'),
  (15,'Pé na Estrada Turismo', 'penaestrada',      'Londrina',       'PR','padrao','Gilberto Faria',    'Amanda Siqueira',   'Rafael Pontes'),
  (16,'Lua Cheia Viagens',     'luacheia',         'Natal',          'RN','padrao','Viviane Torres',    'Leandro Muniz',     'Beatriz Nogueira'),
  (17,'Serra Verde Turismo',   'serraverde',       'Juiz de Fora',   'MG','padrao','Alexandre Rangel',  'Tatiane Vasques',   'Murilo Campos'),
  (18,'Âncora Viagens',        'ancora',           'Santos',         'SP','select','Cláudia Ribeiro',   'Fábio Estevam',     'Larissa Camargo'),
  (19,'Nova Rota Turismo',     'novarota',         'Ribeirão Preto', 'SP','padrao','Sandro Bezerra',    'Elaine Pacheco',    'Igor Medeiros'),
  (20,'Cia do Sonho Viagens',  'ciadosonho',       'Uberlândia',     'MG','padrao','Débora Antunes',    'Wesley Farias',     'Nádia Brito');

-- UUIDs determinísticos (prefixo d0000000-) para as agências de teste:
-- tornam trivial identificar e remover só o que veio deste script.
insert into agencias (id, nome, cidade, uf, tier, sla_horas, ativa)
select
  ('d0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  nome, cidade, uf, tier::tier_agencia,
  case when tier = 'select' then 24 else 48 end,
  true
from _ag;

-- 3 pessoas por agência: k=1 é o Administrador, k=2 e 3 são Agentes.
-- Prefixo e0000000- nos agentes, pelo mesmo motivo.
insert into agentes (id, agencia_id, codigo, nome, email, admin, senha_hash, ativo)
select
  ('e0000000-0000-0000-0000-' || lpad(a.n::text, 6, '0') || lpad(p.k::text, 6, '0'))::uuid,
  ('d0000000-0000-0000-0000-' || lpad(a.n::text, 12, '0'))::uuid,
  'TST' || lpad(a.n::text, 2, '0') || p.letra,
  case p.k when 1 then a.admin_nome when 2 then a.agente1 else a.agente2 end,
  (p.prefixo || '@' || a.slug || '.teste')::citext,
  p.k = 1,
  crypt('teste123', gen_salt('bf')),
  true
from _ag a
cross join (values (1,'admin','A'), (2,'agente1','B'), (3,'agente2','C'))
  as p(k, prefixo, letra);

commit;

-- ---------------------------------------------------------------------
-- 4. Conferência — imprime as credenciais criadas
-- ---------------------------------------------------------------------
\echo ''
\echo '=================================================================='
\echo ' RESET CONCLUIDO — senha de TODOS os logins abaixo: teste123'
\echo '=================================================================='
\echo ''

select
  ag.nome                                        as "Agência",
  ag.tier                                        as "Tier",
  ag.sla_horas                                   as "SLA(h)",
  a.email                                        as "Login",
  case when a.admin then 'ADMIN' else 'agente' end as "Papel",
  '/f/' || a.codigo                              as "Link do formulário"
from agentes a
join agencias ag on ag.id = a.agencia_id
order by ag.nome, a.admin desc, a.codigo;

\echo ''
select
  (select count(*) from agencias)     as "Agências",
  (select count(*) from agentes)      as "Logins",
  (select count(*) from solicitacoes) as "Cards",
  (select count(*) from usuarios where ativo) as "Consultoras ativas";
\echo ''
