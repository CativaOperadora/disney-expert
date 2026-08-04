-- =====================================================================
-- DISNEY EXPERT · Migração 010
-- Isolamento das anotações entre consultoria e agência.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_010_isolamento_anotacoes.sql
--
-- CONTEXTO
--   As anotações da consultoria (eventos tipo 'comentario', escritas em
--   "Registrar anotação" no CRM interno) estavam sendo exibidas na íntegra
--   para a agência, na linha do tempo do Portal. São notas internas —
--   tratam de margem, negociação e perfil da própria agência.
--
--   A correção principal é de código (lib/portal.ts deixou de listar
--   'comentario' entre os eventos visíveis). Esta migração cuida só do
--   efeito colateral nos dados já gravados.
--
-- O QUE MUDA AQUI
--   Os registros que a AGÊNCIA gerou pelo Portal (alteração de valor da
--   venda e de ID da reserva) também tinham sido gravados como
--   'comentario'. Com o corte por tipo, eles sumiriam da vista da própria
--   agência — que é o oposto do desejado, já que são o rastro das ações
--   dela. Passam a ter tipo próprio: 'venda_agencia'.
--
--   O reconhecimento é pelo payload->>'origem' = 'portal', gravado por
--   atualizarVendaPortal. Nenhuma anotação da consultoria tem esse campo,
--   então não há como converter um comentário interno por engano.
-- =====================================================================

begin;

update eventos
   set tipo = 'venda_agencia'
 where tipo = 'comentario'
   and payload->>'origem' = 'portal';

commit;

-- Conferência: deve devolver 0. Qualquer linha aqui é um registro do
-- portal que continuaria escondido da agência.
select count(*) as portal_ainda_como_comentario
  from eventos
 where tipo = 'comentario' and payload->>'origem' = 'portal';
