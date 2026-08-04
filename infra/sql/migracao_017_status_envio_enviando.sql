-- =====================================================================
-- DISNEY EXPERT · Migração 017
-- O valor 'enviando' que faltava no enum status_envio.
--
-- Rodar:
--   cd /opt/disney-expert/infra
--   docker compose exec -T db psql -U disney -d disney_expert \
--     < sql/migracao_017_status_envio_enviando.sql
--
-- Reexecução é segura.
--
-- O DEFEITO
--   `processarFila()` começa marcando as linhas que vai processar:
--
--     update envios_email set status = 'enviando', ...
--
--   É a trava contra processamento duplo — a seleção e a marcação
--   acontecem no mesmo UPDATE, então duas execuções simultâneas não
--   disputam a mesma linha (lib/fila.ts).
--
--   Só que 'enviando' nunca existiu no enum, que nasceu com
--   'pendente', 'enviado', 'entregue', 'aberto', 'bounce', 'spam' e
--   'falha'. O UPDATE é o PRIMEIRO comando da função: ele estourava
--   com 22P02 (invalid input value for enum) e a função morria ali,
--   antes de qualquer chamada ao provedor.
--
--   Consequência: NENHUM e-mail jamais foi enviado por este sistema —
--   nem confirmação de cliente, nem briefing de agente, nem aviso de
--   especialista. Tudo ficou parado em 'pendente' com tentativas = 0,
--   e o zero é a assinatura do defeito: a linha nunca chegou a ser
--   marcada, então o contador nunca subiu.
--
--   Diagnosticado em 04/08/2026, pelo log da aplicação:
--     [solicitacoes] fila c: invalid input value for enum
--     status_envio: "enviando"
--
-- POR QUE ACRESCENTAR O VALOR, E NÃO MUDAR O CÓDIGO
--   O estado intermediário é intencional e está documentado no módulo.
--   Sem ele não há como distinguir "ninguém pegou ainda" de "alguém já
--   está enviando", e a trava contra envio duplicado deixa de existir.
--   Quem estava errado era o enum, não a lógica.
--
-- DEPOIS DE RODAR
--   Os envios acumulados voltam a ser elegíveis sozinhos: a fila busca
--   `status in ('pendente','falha')` e todos estão em 'pendente'. Basta
--   disparar a fila — ou enviar uma solicitação nova, que a dispara.
--
-- ALTER TYPE ADD VALUE não roda dentro de transação: fica solto, sem
-- begin/commit. Mesma restrição das migrações 006 e 016.
-- =====================================================================

alter type status_envio add value if not exists 'enviando';

-- ---------------------------------------------------------------------
-- Conferência.
-- ---------------------------------------------------------------------

-- Precisa listar os oito valores, com 'enviando' entre eles.
select string_agg(e.enumlabel, ', ' order by e.enumsortorder) as valores_do_enum
from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'status_envio';

-- O que está represado na fila. Tudo em 'pendente' com tentativas = 0 é
-- o retrato do defeito: são os envios que nunca foram tentados.
select status::text, count(*) as quantidade, sum(tentativas) as soma_tentativas
from envios_email group by status order by quantidade desc;
