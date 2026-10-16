// Camada da Unique sobre o núcleo do CRM: segmentos (cruzados com a Hotmart),
// status das listas e leitura dos arquivos do SellFlux e da Hotmart.
import { dataBRparaISO, emailValido, lerCSV, nomeValido, telefoneBR, type LinhaContato } from '../../crm/nucleo'

export const EMPRESA_UNIQUE = 'a0000000-0000-4000-8000-000000000001'

export const SEGMENTOS: Record<string, { rotulo: string; tom: string; explica: string }> = {
  comprador: { rotulo: 'Comprador', tom: 'ok', explica: 'Comprou na Hotmart (confirmado) ou é aluno presencial' },
  quase: { rotulo: 'Quase comprou', tom: 'alerta', explica: 'Boleto ou Pix vencido, compra cancelada (confirmado na Hotmart)' },
  marcado: { rotulo: 'Marcado no SellFlux', tom: 'info', explica: 'O SellFlux marcou como aluno ou carrinho, mas a Hotmart não confirma' },
  frio: { rotulo: 'Frio', tom: 'neutro', explica: 'Entrou como lead e nunca comprou' },
}

export const STATUS_LISTA: Record<string, { rotulo: string; tom: string; grupo: 'a_contatar' | 'andamento' | 'fim' | 'comprou' }> = {
  a_contatar: { rotulo: 'A contatar', tom: 'neutro', grupo: 'a_contatar' },
  enviada: { rotulo: 'Mensagem enviada', tom: 'info', grupo: 'andamento' },
  conversando: { rotulo: 'Respondeu', tom: 'ouro', grupo: 'andamento' },
  interessado: { rotulo: 'Interessado', tom: 'ouro', grupo: 'andamento' },
  comprou: { rotulo: 'Comprou', tom: 'ok', grupo: 'comprou' },
  sem_interesse: { rotulo: 'Sem interesse', tom: 'apagado', grupo: 'fim' },
  sem_resposta: { rotulo: 'Não respondeu', tom: 'apagado', grupo: 'fim' },
  numero_errado: { rotulo: 'Número errado', tom: 'erro', grupo: 'fim' },
  nao_quer: { rotulo: 'Não quer receber', tom: 'erro', grupo: 'fim' },
}

export type Filtro = {
  busca?: string; segmento?: string; compra?: string; produto?: string; sem_produto?: string; ano_compra?: string; ano_entrada?: string
  tag?: string; so_whats?: boolean; fora_de_lista?: boolean; arquivados?: '' | 'true' | 'so'
}
export const limparFiltro = (f: Filtro) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined && v !== false)) as Filtro

export function descreverFiltro(f: Filtro) {
  const p: string[] = []
  if (f.segmento === 'comprador_ou_quase') p.push('Compradores e quase compraram')
  else if (f.segmento) p.push(SEGMENTOS[f.segmento]?.rotulo ?? f.segmento)
  if (f.compra) p.push(({ sim: 'já comprou', nao: 'nunca comprou', online: 'comprou no online', presencial: 'aluno do presencial' } as Record<string, string>)[f.compra] ?? f.compra)
  if (f.produto) p.push(`comprou ${f.produto}`)
  if (f.sem_produto) p.push(`não comprou ${f.sem_produto}`)
  if (f.ano_compra) p.push(`comprou em ${f.ano_compra}`)
  if (f.ano_entrada) p.push(`entrou em ${f.ano_entrada}`)
  if (f.tag) p.push(`etiqueta ${f.tag}`)
  if (f.busca) p.push(`busca "${f.busca}"`)
  if (f.fora_de_lista) p.push('fora de outra lista ativa')
  if (f.arquivados === 'so') p.push('só arquivados'); else if (f.arquivados === 'true') p.push('com arquivados')
  return p.length ? p.join(' · ') : 'Todos os contatos'
}

export type ContatoLinha = {
  id: string; nome: string | null; telefone: string | null; emails: string[]; tags: string[]; cidade: string | null; uf: string | null
  entrou_em: string | null; origem: string | null; nao_contatar: boolean; telefone_invalido: boolean
  arquivado_em?: string | null; arquivado_motivo?: string | null; responsavel_id?: string | null
  segmento: string | null; produtos: string[] | null; total_liquido: number | null; ultima_compra: string | null
  aluno_presencial: boolean | null; reembolsou: boolean | null; lista_ativa: string | null
}

export type ItemLista = {
  id: string; status: string; nota: string | null; retornar_em: string | null; ultimo_contato_em: string | null; tentativas: number
  vendedora_id: string | null; vendedora_nome: string | null; contato_id: string; nome: string | null; telefone: string | null
  email: string | null; cidade: string | null; uf: string | null; nao_contatar: boolean; segmento: string | null
  produtos: string[] | null; ultima_compra: string | null; aluno_presencial: boolean | null; total_liquido: number | null; comprou_depois: string | null
}

export type Mensagem = { titulo: string; texto: string }
export type PorVendedora = {
  vendedora_id: string | null; vendedora_nome: string; total: number; a_contatar: number; enviada: number; conversando: number
  comprou: number; encerrados: number; retornar_hoje: number; compraram: number
}
export type Campanha = {
  id: string; nome: string; objetivo: string | null; status: 'ativa' | 'encerrada'; criado_em: string; mensagens: Mensagem[]
  filtro: Filtro | null; por_vendedora: PorVendedora[]
}

/* ───────── leitura de arquivos ───────── */

export type Leitura = {
  tipo: 'sellflux' | 'hotmart' | 'planilha'
  lidas: number
  linhas: LinhaContato[]
  descartes: Record<string, number>
  compradores?: number
  quase?: number
}

const col = (cab: string[], ...nomes: RegExp[]) => cab.findIndex((c) => nomes.some((n) => n.test(c.trim())))

function tagsSellflux(s: string | undefined) {
  if (!s || s === 'null') return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : [] } catch { return [] }
}

const APROVADO = new Set(['Aprovado', 'Completo', 'Atrasado'])           // "Atrasado" = parcelado em andamento: comprou
const QUASE = new Set(['Expirado', 'Boleto impresso', 'Aguardando Pagto', 'Cancelado'])

export function lerArquivoContatos(texto: string): Leitura {
  const { cabecalho: cab, linhas } = lerCSV(texto)
  const descartes: Record<string, number> = {}
  const descarta = (m: string) => { descartes[m] = (descartes[m] ?? 0) + 1 }

  // Hotmart: exportação de vendas
  const iStatus = col(cab, /^Status da transa/i)
  const iMailH = col(cab, /^Email do\(a\) Comprador/i)
  if (iStatus >= 0 && iMailH >= 0) {
    const iNome = col(cab, /^Comprador\(a\)$/i), iTel = col(cab, /^Telefone$/i), iData = col(cab, /^Data da transa/i)
    const iCid = col(cab, /^Cidade$/i), iUf = col(cab, /^Estado/i), iInsta = col(cab, /^Instagram$/i)
    const pessoas = new Map<string, LinhaContato & { _st: Set<string> }>()
    for (const l of linhas) {
      const tel = telefoneBR(l[iTel]), mail = emailValido(l[iMailH])
      if (!tel && !mail) { descarta('sem telefone e sem e-mail'); continue }
      const k = tel ?? mail!
      const p = pessoas.get(k) ?? { nome: null, telefone: tel, emails: [], tags: [], entrou_em: null, _st: new Set<string>() }
      p.nome = p.nome ?? (nomeValido(l[iNome]) ?? (l[iNome]?.trim() || null))
      if (mail && !p.emails!.includes(mail)) p.emails!.push(mail)
      const dt = dataBRparaISO(l[iData])
      if (dt && (!p.entrou_em || dt < p.entrou_em)) p.entrou_em = dt
      p.cidade = p.cidade ?? (l[iCid]?.trim() || null)
      p.uf = p.uf ?? (l[iUf]?.trim().length === 2 ? l[iUf].trim() : null)
      const ig = l[iInsta]?.trim()
      if (!p.instagram && ig && ig !== '(none)') p.instagram = ig
      p._st.add(l[iStatus]?.trim())
      pessoas.set(k, p)
    }
    let compradores = 0, quase = 0
    const saida: LinhaContato[] = []
    for (const p of pessoas.values()) {
      const st = [...p._st]
      const tags = ['hotmart']
      if (st.some((s) => APROVADO.has(s))) { tags.push('hotmart-comprador'); compradores++ }
      else if (st.some((s) => QUASE.has(s))) { tags.push('hotmart-quase'); quase++ }
      if (st.some((s) => s === 'Reembolsado' || s === 'Chargeback')) tags.push('hotmart-reembolso')
      const { _st, ...resto } = p
      void _st
      saida.push({ ...resto, tags })
    }
    return { tipo: 'hotmart', lidas: linhas.length, linhas: saida, descartes, compradores, quase }
  }

  // SellFlux ou planilha qualquer com nome/telefone/e-mail
  const ehSellflux = cab.includes('id_projeto') && cab.includes('creation_date')
  const iNome = col(cab, /^nome$/i, /^name$/i, /^nome completo$/i)
  const iTel = col(cab, /^telefone$/i, /^whats/i, /^celular$/i, /^phone$/i, /^fone$/i)
  const iMail = col(cab, /^e-?mail$/i)
  const iTags = col(cab, /^tags?$/i, /^etiquetas?$/i)
  const iData = col(cab, /^creation_date$/i, /^data/i)
  if (iTel < 0) throw new Error('Não achei a coluna de telefone/WhatsApp no arquivo.')
  const vistos = new Map<string, LinhaContato>()
  for (const l of linhas) {
    const bruto = (l[iTel] ?? '').replace(/\D/g, '')
    const tel = telefoneBR(l[iTel])
    if (!tel) {
      if (!bruto) descarta('sem telefone')
      else if (bruto.startsWith('1') || (bruto.length > 13)) descarta('número estrangeiro ou falso (+1 555…)')
      else descarta('telefone fixo ou quebrado')
      continue
    }
    const nome = iNome >= 0 ? nomeValido(l[iNome]) : null
    if (!nome) { descarta('nome vazio ou inválido'); continue }
    const mail = iMail >= 0 ? emailValido(l[iMail]) : null
    const tags = iTags >= 0 ? (ehSellflux ? tagsSellflux(l[iTags]) : l[iTags].split(/[;,|]/).map((t) => t.trim()).filter(Boolean)) : []
    const ja = vistos.get(tel)
    if (ja) {
      descarta('repetido no arquivo (juntado)')
      if (mail && !ja.emails!.includes(mail)) ja.emails!.push(mail)
      ja.tags = [...new Set([...(ja.tags ?? []), ...tags])]
      continue
    }
    vistos.set(tel, { nome, telefone: tel, emails: mail ? [mail] : [], tags: ehSellflux ? ['sellflux', ...tags] : tags, entrou_em: iData >= 0 ? dataBRparaISO(l[iData]) : null })
  }
  return { tipo: ehSellflux ? 'sellflux' : 'planilha', lidas: linhas.length, linhas: [...vistos.values()], descartes }
}

// soma do andamento de uma lista (todas as vendedoras visíveis)
export const somar = (xs: PorVendedora[]) => xs.reduce((s, v) => ({
  total: s.total + v.total, a_contatar: s.a_contatar + v.a_contatar, andamento: s.andamento + v.enviada + v.conversando,
  conversando: s.conversando + v.conversando, compraram: s.compraram + Math.max(v.comprou, v.compraram), retornar_hoje: s.retornar_hoje + v.retornar_hoje,
}), { total: 0, a_contatar: 0, andamento: 0, conversando: 0, compraram: 0, retornar_hoje: 0 })

