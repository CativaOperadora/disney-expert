-- =====================================================================
-- DISNEY EXPERT · Migração 015
-- Nomes completos das especialistas.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_015_nomes_especialistas.sql
--
--     Juliana   ->  Juliana Bertolini
--     Bighetti  ->  Biguetti          (grafia corrigida, com U)
--
-- ONDE O NOME APARECE
--   · coluna do Kanban interno — usa só o PRIMEIRO nome, então a coluna
--     segue "Consultoria Juliana" e passa a "Consultoria Biguetti";
--   · rankings por consultora no BI;
--   · ficha da solicitação, em "Responsável".
--
--   O nome do Portal (o que a agência vê como "Consultora: ...") também
--   vem daqui, então a correção alcança os dois lados.
--
-- Reexecução é segura: identifica pelo id fixo, não pelo nome antigo.
-- =====================================================================

begin;

update usuarios set nome = 'Juliana Bertolini'
 where id = 'c0000000-0000-0000-0000-000000000001';

update usuarios set nome = 'Biguetti'
 where id = 'c0000000-0000-0000-0000-000000000004';

commit;

select nome, email, ativo, (senha_hash is not null) as tem_senha
from usuarios
where id in ('c0000000-0000-0000-0000-000000000001',
             'c0000000-0000-0000-0000-000000000004')
order by nome;
