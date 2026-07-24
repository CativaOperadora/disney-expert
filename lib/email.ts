/**
 * Envio de e-mail via Resend.
 *
 * MODO DE TESTE
 * Enquanto EMAIL_TESTE estiver preenchida, todas as mensagens vão para
 * esse endereço, com um aviso no topo informando o destinatário real.
 * Permite validar o fluxo completo antes de existir domínio verificado
 * ou caixa da especialista. Basta apagar a variável para desligar.
 */

const API = 'https://api.resend.com/emails';

export interface Mensagem {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}

export function emTeste(): string | null {
  const t = process.env.EMAIL_TESTE?.trim();
  return t && t.includes('@') ? t : null;
}

function remetente(): string {
  const r = process.env.EMAIL_REMETENTE?.trim();
  // onboarding@resend.dev funciona sem domínio verificado, mas só entrega
  // para o e-mail cadastrado na conta do Resend.
  if (!r || r.includes('envios.cativa.tur.br')) {
    return 'Cativa <onboarding@resend.dev>';
  }
  return r;
}

const AVISO_TESTE = (real: string) => `
<div style="background:#fff8e0;border:1px solid #f5e2a8;border-left:4px solid #ffcd28;
padding:12px 16px;margin-bottom:20px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#16202b">
<strong>Modo de teste.</strong> Em produção esta mensagem iria para
<strong>${real}</strong>.
</div>`;

export async function enviar(msg: Mensagem): Promise<string> {
  const chave = process.env.EMAIL_API_KEY;
  if (!chave) throw new Error('EMAIL_API_KEY ausente no .env');

  const teste = emTeste();
  const destino = teste ?? msg.para;
  const html = teste ? AVISO_TESTE(msg.para) + msg.html : msg.html;
  const texto = teste
    ? `[TESTE] Em produção iria para: ${msg.para}\n\n${msg.texto}`
    : msg.texto;

  const resposta = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remetente(),
      to: [destino],
      reply_to: process.env.EMAIL_RESPOSTA || undefined,
      subject: teste ? `[teste] ${msg.assunto}` : msg.assunto,
      html,
      text: texto,
    }),
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(
      `Resend ${resposta.status}: ${dados?.message ?? 'erro desconhecido'}`,
    );
  }
  return dados.id as string;
}
