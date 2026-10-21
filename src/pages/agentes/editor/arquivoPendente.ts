// O vídeo escolhido em "Editar um vídeo" (página do Agente Editor) passa para a aba de edição da peça sem subir para
// lugar nenhum: fica guardado aqui, na memória da página, até a aba abrir e pegar.
let pendente: { peca: string; arquivo: File } | null = null

export const deixarArquivo = (peca: string, arquivo: File) => { pendente = { peca, arquivo } }
export function pegarArquivo(peca: string) {
  if (pendente?.peca !== peca) return null
  const f = pendente.arquivo
  pendente = null
  return f
}
