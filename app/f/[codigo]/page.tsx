import { resolverAgente } from '@/lib/db';
import Formulario from './Formulario';

export const dynamic = 'force-dynamic';

/**
 * Layout Orlando Expert.
 *
 * Duas colunas no desktop: a arte à esquerda, o cartão do formulário
 * flutuando à direita sobre o degradê. No celular vira coluna única,
 * com a frase reduzida acima do cartão.
 *
 * A marca Cativa não aparece em nenhum ponto desta tela. O cliente final
 * enxerga a ferramenta como sendo da agência dele.
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
      <div className="tela-form">
        <div className="area-form area-form-sozinha">
          <div className="cartao-form">
            <div className="aviso">
              <h1 className="display aviso-titulo">Este link não está ativo</h1>
              <p className="aviso-texto">
                Pode ter sido copiado com algum caractere a mais, ou o consultor
                que o enviou não está mais atendendo. Peça um link novo para a
                sua agência de viagem.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tela-form">
      <aside className="arte" aria-hidden="true">
        <img src="/frase-jornada.png" alt="" className="arte-frase" />
      </aside>

      <div className="area-form">
        <div className="cartao-form">
          <Formulario
            codigo={codigo}
            agenteNome={agente.agente_nome}
            agenciaNome={agente.agencia_nome}
          />
        </div>

        <p className="rodape">
          Seus dados são usados apenas para a elaboração da sua proposta de
          viagem e ficam disponíveis para {agente.agencia_nome}.
        </p>
      </div>
    </div>
  );
}
