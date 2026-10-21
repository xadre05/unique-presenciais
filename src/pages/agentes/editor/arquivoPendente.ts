// O vídeo bruto de cada peça, guardado na memória da página enquanto ela estiver aberta: não sobe para lugar nenhum,
// mas não some ao trocar de aba (Vídeos ↔ Estilo, Legenda ↔ Edição do vídeo) nem ao ir e voltar entre peças.
// Some só ao recarregar ou fechar a página (aí é preciso escolher o arquivo de novo).
const arquivos = new Map<string, File>()

export const deixarArquivo = (peca: string, arquivo: File) => { arquivos.set(peca, arquivo) }
export const pegarArquivo = (peca: string) => arquivos.get(peca) ?? null
