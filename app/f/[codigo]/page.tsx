import { resolverAgente } from '@/lib/db';
import Formulario from './Formulario';

export const dynamic = 'force-dynamic';

/**
 * O código do agente vem no caminho da URL: /f/CTV8213
 *
 * A resolução acontece no servidor, antes de qualquer coisa aparecer na
 * tela. Assim o e-mail do agente nunca circula no navegador e o cliente
 * não tem como digitar endereço errado.
 */
export default async function PaginaFormulario({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const agente = await resolverAgente(codigo);

  if (!agente) {
    return (
      <main className="pagina">
        <div className="aviso">
          <h1 className="display aviso-titulo">Este link não está ativo</h1>
          <p className="aviso-texto">
            Pode ter sido digitado com algum caractere a mais, ou o consultor
            que o enviou não está mais atendendo. Peça um link novo para a sua
            agência de viagem.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pagina">
      <Formulario
        codigo={codigo}
        agenteNome={agente.agente_nome}
        agenciaNome={agente.agencia_nome}
      />
      <p className="rodape">
        Seus dados são usados apenas para a elaboração da sua proposta de
        viagem e ficam disponíveis para {agente.agencia_nome}.
      </p>
    </main>
  );
}
