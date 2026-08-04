/**
 * Limites de anexo, isolados dos módulos de servidor.
 *
 * lib/anexos.ts importa node:fs e node:crypto, então não pode ser puxado
 * por um componente cliente. O modal de perda precisa dos mesmos números
 * para avisar o usuário ANTES do envio — daí este arquivo sem dependência
 * de runtime, seguro para os dois lados.
 */

export const MAX_ARQUIVOS = 5;
export const MAX_BYTES = 5 * 1024 * 1024;
export const LIMITE_MB = MAX_BYTES / 1024 / 1024;

/** Formatos aceitos. SVG fica de fora: é XML, executa script. */
export const MIMES_ACEITOS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const ACCEPT_ARQUIVO = MIMES_ACEITOS.join(',');
