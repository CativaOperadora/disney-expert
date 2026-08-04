import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sql } from './db';
import { MAX_ARQUIVOS, MAX_BYTES, LIMITE_MB } from './anexos-limites';

/**
 * Armazenamento de anexos de imagem.
 *
 * PRINCÍPIOS
 *
 * 1. O binário fica FORA do banco e FORA de public/. Em public/ o Next
 *    serviria o arquivo estaticamente, sem passar por nenhuma checagem de
 *    sessão — uma solicitação de outra agência vazaria por URL adivinhada.
 *    Tudo sai pela rota /api/anexos/[id], que confere a sessão antes.
 *
 * 2. O nome do arquivo em disco é gerado aqui (uuid + extensão da lista
 *    branca). O nome enviado pelo usuário é entrada hostil: "../../.env"
 *    viraria travessia de diretório. Ele é guardado só como rótulo.
 *
 * 3. O tipo é decidido pelos BYTES, nunca pelo Content-Type declarado. Um
 *    HTML com XSS anunciado como image/png seria servido como página se
 *    confiássemos no cliente.
 */

export { MAX_ARQUIVOS, MAX_BYTES, LIMITE_MB };

/** Diretório dos anexos. Volume próprio no Docker; ./uploads em dev. */
function diretorio(): string {
  return resolve(process.env.DIRETORIO_ANEXOS ?? './uploads');
}

/**
 * Assinaturas de arquivo (magic bytes). Só estes formatos entram.
 * SVG está deliberadamente FORA: SVG é XML, executa script, e serví-lo
 * de volta ao navegador seria XSS armazenado.
 */
const ASSINATURAS: { mime: string; ext: string; teste: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/jpeg', ext: 'jpg',
    teste: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png', ext: 'png',
    teste: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: 'image/gif', ext: 'gif',
    teste: (b) => b.subarray(0, 6).toString('latin1').match(/^GIF8[79]a$/) !== null,
  },
  {
    mime: 'image/webp', ext: 'webp',
    teste: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export interface Anexo {
  id: string;
  nome_original: string;
  mime: string;
  tamanho: number;
  criado_em: string;
}

export type ResultadoUpload =
  | { ok: true; anexo: Anexo }
  | { ok: false; erro: string };

/** Grava um arquivo e registra os metadados. Valida tamanho e conteúdo. */
export async function guardarAnexo(
  solicitacaoId: string,
  arquivo: File,
  contexto = 'perda',
): Promise<ResultadoUpload> {
  if (arquivo.size === 0) return { ok: false, erro: 'Arquivo vazio.' };
  if (arquivo.size > MAX_BYTES) {
    return { ok: false, erro: `Cada imagem deve ter no máximo ${LIMITE_MB} MB.` };
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const tipo = ASSINATURAS.find((a) => a.teste(bytes));
  if (!tipo) {
    return {
      ok: false,
      erro: 'Envie uma imagem JPG, PNG, GIF ou WEBP. O arquivo enviado não é uma dessas.',
    };
  }

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int n from anexos
    where solicitacao_id = ${solicitacaoId} and contexto = ${contexto}`;
  if (n >= MAX_ARQUIVOS) {
    return { ok: false, erro: `Máximo de ${MAX_ARQUIVOS} imagens por registro.` };
  }

  const nomeDisco = `${randomUUID()}.${tipo.ext}`;
  const dir = diretorio();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, nomeDisco), bytes);

  try {
    const [reg] = await sql<Anexo[]>`
      insert into anexos (solicitacao_id, contexto, arquivo, nome_original, mime, tamanho)
      values (${solicitacaoId}, ${contexto}, ${nomeDisco},
              ${arquivo.name.slice(0, 200)}, ${tipo.mime}, ${bytes.length})
      returning id, nome_original, mime, tamanho, criado_em`;
    return { ok: true, anexo: reg };
  } catch (e) {
    // O registro falhou: remove o arquivo para não deixar órfão no volume.
    await unlink(join(dir, nomeDisco)).catch(() => {});
    throw e;
  }
}

export async function listarAnexos(
  solicitacaoId: string,
  contexto = 'perda',
): Promise<Anexo[]> {
  return sql<Anexo[]>`
    select id, nome_original, mime, tamanho, criado_em
    from anexos
    where solicitacao_id = ${solicitacaoId} and contexto = ${contexto}
    order by criado_em`;
}

export interface AnexoConteudo {
  bytes: Buffer;
  mime: string;
  nome: string;
  solicitacaoId: string;
}

/**
 * Lê um anexo do disco. NÃO faz controle de acesso — devolve também o
 * solicitacao_id justamente para quem chamou decidir se pode entregar.
 */
export async function lerAnexo(id: string): Promise<AnexoConteudo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [reg] = await sql<
    { arquivo: string; mime: string; nome_original: string; solicitacao_id: string }[]
  >`select arquivo, mime, nome_original, solicitacao_id from anexos where id = ${id}`;
  if (!reg) return null;

  // O nome vem do banco e foi gerado por nós, mas a checagem abaixo é
  // barata e garante que nenhum caminho escape do diretório de anexos.
  if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/i.test(reg.arquivo)) return null;

  try {
    const bytes = await readFile(join(diretorio(), reg.arquivo));
    return {
      bytes,
      mime: reg.mime,
      nome: reg.nome_original,
      solicitacaoId: reg.solicitacao_id,
    };
  } catch {
    return null; // registro sem arquivo no volume
  }
}
