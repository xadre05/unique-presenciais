// Lê o texto de um arquivo no navegador (PDF, Word, texto) e divide em trechos para a Biblioteca da marca.
// Os leitores de PDF e Word só são carregados quando alguém envia um desses arquivos.

export type TipoFonte = 'pdf' | 'docx' | 'texto'
export const ACEITOS = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown'
const TAM_TRECHO = 1400

export function tipoDoArquivo(nome: string): TipoFonte | null {
  if (/\.pdf$/i.test(nome)) return 'pdf'
  if (/\.docx$/i.test(nome)) return 'docx'
  if (/\.(txt|md)$/i.test(nome)) return 'texto'
  return null
}

async function lerPdf(arquivo: File) {
  const pdfjs = await import('pdfjs-dist')
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
  const paginas: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n)
    const conteudo = await pagina.getTextContent()
    paginas.push(conteudo.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join(''))
  }
  return paginas.join('\n\n')
}

async function lerWord(arquivo: File) {
  const mammoth = await import('mammoth/mammoth.browser.min.js')
  const { value } = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: await arquivo.arrayBuffer() })
  return value as string
}

export async function lerTexto(arquivo: File): Promise<string> {
  const tipo = tipoDoArquivo(arquivo.name)
  if (tipo === 'pdf') return lerPdf(arquivo)
  if (tipo === 'docx') return lerWord(arquivo)
  if (tipo === 'texto') return arquivo.text()
  throw new Error('Formato não aceito. Envie PDF, Word (.docx) ou texto (.txt).')
}

// junta parágrafos até ~1400 caracteres; parágrafo maior que isso é quebrado nas frases
export function dividirEmTrechos(texto: string): string[] {
  const limpo = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const partes = limpo.split(/\n\s*\n/).flatMap((p) => (p.length <= TAM_TRECHO ? [p] : p.split(/(?<=[.!?])\s+/)))
  const trechos: string[] = []
  let atual = ''
  for (const p of partes.map((x) => x.trim()).filter(Boolean)) {
    if (atual && atual.length + p.length + 2 > TAM_TRECHO) { trechos.push(atual); atual = '' }
    atual = atual ? `${atual}\n\n${p}` : p.slice(0, TAM_TRECHO * 2)
  }
  if (atual) trechos.push(atual)
  return trechos.filter((t) => t.length >= 40)
}
