// O vídeo bruto de cada peça. Não sobe para lugar nenhum: fica na memória da página (não some ao trocar de aba ou de
// tela) e, quando o navegador permite (Chrome e Edge), o "atalho" para o arquivo fica guardado no próprio navegador
// (IndexedDB). Depois de recarregar, basta um clique em "Reabrir" para o vídeo voltar, sem procurar o arquivo.
const arquivos = new Map<string, File>()

type Atalho = { getFile: () => Promise<File>; name: string; queryPermission?: (o: { mode: 'read' }) => Promise<string>; requestPermission?: (o: { mode: 'read' }) => Promise<string> }
type ItemComAtalho = DataTransferItem & { getAsFileSystemHandle?: () => Promise<Atalho | null> }
type JanelaComSeletor = Window & { showOpenFilePicker?: (o: unknown) => Promise<Atalho[]> }

const BANCO = 'editor-video', TABELA = 'atalhos'
function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(TABELA)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => falha(r.error)
  })
}
async function naTabela<T>(modo: IDBTransactionMode, fazer: (t: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await abrirBanco()
    return await new Promise<T>((ok, falha) => {
      const r = fazer(db.transaction(TABELA, modo).objectStore(TABELA))
      r.onsuccess = () => ok(r.result as T)
      r.onerror = () => falha(r.error)
    })
  } catch { return undefined } // janela anônima ou navegador sem IndexedDB: segue só com a memória
}

export function deixarArquivo(peca: string, arquivo: File, atalho?: Atalho | null) {
  arquivos.set(peca, arquivo)
  if (atalho) void naTabela('readwrite', (t) => t.put(atalho, peca))
}
export const pegarArquivo = (peca: string) => arquivos.get(peca) ?? null
// vídeo gravado em partes, escolhido na entrada do Editor: o Estúdio abre com as partes para o agente organizar
const partesPendentes = new Map<string, File[]>()
export const deixarPartes = (peca: string, fs: File[]) => { partesPendentes.set(peca, fs) }
export const pegarPartes = (peca: string) => { const fs = partesPendentes.get(peca) ?? null; partesPendentes.delete(peca); return fs }

// atalho guardado de uma peça (só o nome, para mostrar "Reabrir nome.mp4")
export async function atalhoGuardado(peca: string) {
  return (await naTabela<Atalho>('readonly', (t) => t.get(peca))) ?? null
}
// precisa ser chamado num clique (o navegador pede a permissão de leitura de novo depois de recarregar)
export async function reabrir(peca: string) {
  const atalho = await atalhoGuardado(peca)
  if (!atalho) return null
  const pode = (await atalho.queryPermission?.({ mode: 'read' })) === 'granted' || (await atalho.requestPermission?.({ mode: 'read' })) === 'granted'
  if (!pode) return null
  const f = await atalho.getFile()
  arquivos.set(peca, f)
  return f
}

// o arquivo arrastado, com o atalho quando o navegador dá
// (tudo o que lê o arraste roda antes do primeiro await: depois do evento o navegador esvazia o DataTransfer)
export async function doArraste(e: DataTransfer) {
  const primeiro = e.files[0]
  const item = [...e.items].find((i) => i.kind === 'file') as ItemComAtalho | undefined
  const pedido = item?.getAsFileSystemHandle?.().catch(() => null)
  const atalho = (await pedido) ?? null
  const arquivo = atalho ? await atalho.getFile() : primeiro
  return { arquivo: arquivo ?? null, atalho }
}
// escolher pelo seletor do sistema, com atalho; null = navegador sem seletor (usar o <input type=file>)
export async function escolherComAtalho(): Promise<{ arquivo: File; atalho: Atalho } | 'cancelado' | null> {
  const w = window as JanelaComSeletor
  if (!w.showOpenFilePicker) return null
  try {
    const [atalho] = await w.showOpenFilePicker({ types: [{ description: 'Vídeo', accept: { 'video/*': ['.mp4', '.mov', '.m4v', '.webm'] } }] })
    return { arquivo: await atalho.getFile(), atalho }
  } catch { return 'cancelado' }
}
export type { Atalho }
// várias partes de uma vez (vídeo gravado em pedaços); o atalho só é guardado quando é um arquivo só
export async function escolherVarios(): Promise<{ arquivos: File[]; atalhos: Atalho[] } | 'cancelado' | null> {
  const w = window as JanelaComSeletor
  if (!w.showOpenFilePicker) return null
  try {
    const atalhos = await w.showOpenFilePicker({ multiple: true, types: [{ description: 'Vídeo', accept: { 'video/*': ['.mp4', '.mov', '.m4v', '.webm'] } }] })
    return { arquivos: await Promise.all(atalhos.map((a) => a.getFile())), atalhos }
  } catch { return 'cancelado' }
}
