import { PERGUNTAS, PASSOS, textoIdades } from './perguntas';
import type { Mensagem } from './email';

/**
 * Templates das mensagens.
 *
 * HTML de e-mail é território hostil: o Outlook usa o motor do Word e o
 * Gmail remove blocos <style>. Por isso tudo aqui é tabela com estilo
 * embutido, largura fixa de 600px e nenhuma informação presa em imagem.
 * Toda mensagem sai também em texto puro, o que melhora a entrega.
 */

const AZUL = '#004b8a';
const AMARELO = '#ffcd28';
const FONTE = 'Arial,Helvetica,sans-serif';

export interface DadosBriefing {
  protocolo: string;
  clienteNome: string;
  clienteEmail: string;
  clienteWhatsapp: string;
  dataPrevistaTexto: string | null;
  totalPessoas: number | null;
  totalCriancas: number | null;
  completude: number;
  respostas: Record<string, any>;
  agenteNome: string;
  agenciaNome: string;
  urlPainel?: string;
}

function valor(v: any): string {
  // Idades vêm com a unidade: "5 e 8" sozinho não diz anos.
  const idades = textoIdades(v);
  if (idades) return idades;
  if (Array.isArray(v)) return v.join(', ');
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split('-');
    return `${d}/${m}/${a}`;
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) {
    const [a, m] = v.split('-');
    return `${m}/${a}`;
  }
  return String(v ?? '');
}

function escapar(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

function moldura(titulo: string, corpo: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
 style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden">

<tr><td style="background:${AZUL};padding:20px 26px">
  <span style="font:600 20px ${FONTE};color:#ffffff;border-bottom:3px solid ${AMARELO};padding-bottom:3px">Cativa</span>
  <span style="font:15px ${FONTE};color:rgba(255,255,255,.8);padding-left:12px">Consultoria Disney</span>
</td></tr>

<tr><td style="padding:26px">${corpo}</td></tr>

<tr><td style="background:#f6f6f4;padding:18px 26px;font:12px/1.5 ${FONTE};color:#7c8894">
  Cativa Operadora – Orlando Expert<br>
  Mensagem automática do Planejador de Viagem.
</td></tr>

</table></td></tr></table></body></html>`;
}

function destaque(itens: [string, string][]) {
  const linhas = itens
    .filter(([, v]) => v)
    .map(
      ([r, v]) => `<tr>
<td style="padding:7px 0;font:13px ${FONTE};color:#7c8894;width:42%">${escapar(r)}</td>
<td style="padding:7px 0;font:600 15px ${FONTE};color:#16202b">${escapar(v)}</td>
</tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="background:#e8f0f7;border-radius:10px;padding:14px 18px;margin-bottom:22px">
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table></td></tr></table>`;
}

// ===================================================================== agente

export function briefingAgente(d: DadosBriefing): Mensagem {
  const r = d.respostas;

  const grupo = [
    d.totalPessoas ? `${d.totalPessoas} pessoas` : null,
    d.totalCriancas ? `${d.totalCriancas} criança${d.totalCriancas > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const cabecalho = destaque([
    ['Cliente', d.clienteNome],
    ['Grupo', grupo],
    ['Período', d.dataPrevistaTexto ?? 'não informado'],
    ['Saindo de', valor(r.origem_embarque)],
  ]);

  // Blocos na ordem do formulário, não na ordem do banco.
  const blocos = PASSOS.filter((p) => p.numero >= 2)
    .map((passo) => {
      const itens = PERGUNTAS.filter(
        (p) =>
          p.passo === passo.numero &&
          p.tipo !== 'aceite' &&
          r[p.id] !== undefined &&
          r[p.id] !== '',
      );
      if (itens.length === 0) return '';

      const linhas = itens
        .map(
          (p) => `<tr>
<td style="padding:9px 0;border-bottom:1px solid #f3f3f1;font:14px ${FONTE};color:#7c8894;width:45%;vertical-align:top">${escapar(p.rotulo)}</td>
<td style="padding:9px 0;border-bottom:1px solid #f3f3f1;font:15px ${FONTE};color:#16202b;vertical-align:top">${escapar(valor(r[p.id]))}</td>
</tr>`,
        )
        .join('');

      return `<h2 style="font:600 13px ${FONTE};color:${AZUL};letter-spacing:.07em;
text-transform:uppercase;margin:26px 0 6px;padding-bottom:8px;border-bottom:2px solid ${AMARELO}">
${escapar(passo.titulo)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table>`;
    })
    .join('');

  const alerta =
    d.completude < 100
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="background:#fff8e0;border-left:4px solid ${AMARELO};border-radius:8px;margin:22px 0">
<tr><td style="padding:13px 16px;font:14px/1.5 ${FONTE};color:#16202b">
O cliente deixou <strong>${100 - d.completude}%</strong> das perguntas em branco.
Vale confirmar esses pontos antes de montar a proposta.</td></tr></table>`
      : '';

  const html = moldura(
    `Diagnóstico Disney · ${d.clienteNome}`,
    `<p style="font:15px/1.6 ${FONTE};color:#4a5764;margin:0 0 6px">Olá, ${escapar(d.agenteNome.split(' ')[0])}.</p>
<h1 style="font:600 22px ${FONTE};color:${AZUL};margin:0 0 6px">${escapar(d.clienteNome)} quer ir para Orlando</h1>
<p style="font:14px ${FONTE};color:#7c8894;margin:0 0 20px">Protocolo ${escapar(d.protocolo)}</p>

${cabecalho}
${alerta}

<p style="font:15px/1.6 ${FONTE};color:#4a5764;margin:0 0 4px">
Fale com o cliente por <strong>${escapar(d.clienteWhatsapp)}</strong> ou
<strong>${escapar(d.clienteEmail)}</strong>.</p>

${blocos}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="background:#e8f0f7;border-radius:10px;margin-top:28px">
<tr><td style="padding:16px 18px;font:14px/1.6 ${FONTE};color:#16202b">
A nossa especialista em Orlando também recebeu a sua solicitação e, em até 48 horas,
entrará em contato com você para iniciar a sua consultoria.</td></tr></table>`,
  );

  const texto = [
    `DIAGNÓSTICO DISNEY · ${d.protocolo}`,
    '',
    `Cliente: ${d.clienteNome}`,
    `Contato: ${d.clienteWhatsapp} · ${d.clienteEmail}`,
    `Grupo: ${grupo}`,
    `Período: ${d.dataPrevistaTexto ?? 'não informado'}`,
    '',
    ...PERGUNTAS.filter(
      (p) => p.passo >= 2 && p.tipo !== 'aceite' && r[p.id] !== undefined,
    ).map((p) => `${p.rotulo}: ${valor(r[p.id])}`),
    '',
    'A nossa especialista em Orlando também recebeu a sua solicitação e, em até',
    '48 horas, entrará em contato com você para iniciar a sua consultoria.',
    '',
    'Cativa Operadora – Orlando Expert',
  ].join('\n');

  return {
    para: '',
    assunto: `Diagnóstico Disney · ${d.clienteNome}${d.dataPrevistaTexto ? ` · ${d.dataPrevistaTexto}` : ''}`,
    html,
    texto,
  };
}

// ==================================================================== cliente

export function confirmacaoCliente(d: DadosBriefing): Mensagem {
  const primeiro = d.clienteNome.split(' ')[0];

  const html = moldura(
    'Recebemos suas respostas',
    `<h1 style="font:600 23px ${FONTE};color:${AZUL};margin:0 0 14px">Recebemos suas respostas, ${escapar(primeiro)}</h1>

<p style="font:16px/1.65 ${FONTE};color:#4a5764;margin:0 0 16px">
Seu planejamento de viagem para Orlando já está com
<strong>${escapar(d.agenteNome)}</strong>, da ${escapar(d.agenciaNome)}.
É ele quem vai falar com você para dar sequência.</p>

<p style="font:16px/1.65 ${FONTE};color:#4a5764;margin:0 0 22px">
Enquanto isso, guarde o número do seu atendimento. Ele facilita se você
precisar retomar a conversa.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
<tr><td style="background:#e8f0f7;border-radius:10px;padding:12px 20px;
font:600 16px ui-monospace,Menlo,monospace;color:${AZUL};letter-spacing:.06em">
${escapar(d.protocolo)}</td></tr></table>

<p style="font:14px/1.6 ${FONTE};color:#7c8894;margin:0">
Não é preciso responder esta mensagem.</p>`,
  );

  const texto = [
    `Recebemos suas respostas, ${primeiro}.`,
    '',
    `Seu planejamento está com ${d.agenteNome}, da ${d.agenciaNome}.`,
    'É ele quem vai falar com você para dar sequência.',
    '',
    `Número do atendimento: ${d.protocolo}`,
    '',
    'Cativa Operadora – Orlando Expert',
  ].join('\n');

  return {
    para: '',
    assunto: 'Recebemos seu planejamento de viagem para Orlando',
    html,
    texto,
  };
}

// ================================================================ especialista

export function copiaEspecialista(d: DadosBriefing): Mensagem {
  const base = briefingAgente(d);
  const link = d.urlPainel
    ? `<p style="font:15px ${FONTE};margin:0 0 18px">
<a href="${d.urlPainel}" style="color:${AZUL};font-weight:600">Abrir no painel</a></p>`
    : '';

  // A tarja "Cópia interna…" foi removida a pedido. Mantemos apenas o
  // atalho para o painel, quando houver URL configurada.
  return {
    para: '',
    assunto: `[interno] ${base.assunto} · ${d.agenciaNome}`,
    html: link
      ? base.html.replace('<h1 style="font:600 22px', link + '<h1 style="font:600 22px')
      : base.html,
    texto: base.texto,
  };
}
