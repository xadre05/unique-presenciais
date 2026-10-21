// Criativos NOSSOS que venderam (21/10/2026): o ranking sai das vendas da Hotmart (o código de rastreio guarda qual
// anúncio do Facebook vendeu). A equipe sobe o vídeo do anúncio campeão (ou cola o texto); o navegador transcreve e tira
// quadros, e aqui o agente decompõe o ROTEIRO: gancho, argumento, prova, oferta, chamada e por que vendeu. Por ser
// da própria empresa, as frases podem ser reaproveitadas nos próximos roteiros (diferente das referências de terceiros).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { blocosDeQuadros, type Ia } from './canal.ts'

const texto = (descricao: string) => ({ type: 'string', description: descricao })
const FERRAMENTA = {
  name: 'entregar_roteiro', description: 'Entrega a decomposição do roteiro do criativo que vendeu.',
  input_schema: { type: 'object', required: ['resumo', 'gancho', 'estrutura', 'por_que_funciona', 'como_usar'], properties: {
    resumo: texto('Uma frase: que tipo de criativo é e qual é a ideia central que vendeu'),
    gancho: texto('A frase (ou imagem) de abertura, como foi dita, e por que prende'),
    estrutura: { type: 'array', items: { type: 'string' }, description: 'O roteiro cena por cena, com a fala resumida de cada uma (pode citar as frases fortes como foram ditas)' },
    argumento: texto('O argumento central: qual dor, desejo ou crença o vídeo usa para convencer'),
    prova: texto('O que dá credibilidade: números, resultados de alunos, autoridade, demonstração'),
    oferta: texto('Como a oferta é apresentada: o que leva, preço, condição, urgência (lote, vagas, prazo)'),
    texto_na_tela: texto('Textos e legendas que aparecem, se der para ver'),
    linguagem: texto('Tom e jeito de falar: frases curtas, perguntas, eu/você'),
    por_que_funciona: texto('Por que este roteiro vendeu, cruzando com os números de venda enviados'),
    como_usar: texto('Como reaproveitar na próxima campanha: 2 ou 3 variações de gancho e o que manter igual'),
  } },
}
const SISTEMA = [
  'Você é o Agente de Marketing de uma escola de harmonização orofacial e estuda os criativos DA PRÓPRIA EMPRESA que mais venderam.',
  'O foco é o ROTEIRO (o que é dito e em que ordem), não a edição. Use a transcrição como fonte principal e os quadros só para o que aparece na tela.',
  'Não invente fala que não está na transcrição. Se faltar transcrição, diga.',
  'As frases são da própria empresa: pode citá-las como foram ditas.',
  'Português do Brasil, frases curtas e concretas. Responda chamando a ferramenta entregar_roteiro.',
].join('\n')

// o Agente de Marketing aprende o campeão: uma linha na memória dele (entra em toda escrita e na reunião de pauta).
// Se o mesmo criativo for estudado de novo, a linha antiga é trocada.
const curto = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
async function ensinarMarketing(db: SupabaseClient, empresa: string, nome: string, vendas: unknown, f: Record<string, unknown>) {
  const marca = `Roteiro que vendeu "${nome}"`
  const texto = `${marca} (${vendas ?? '?'} compradores): gancho — ${curto(f.gancho, 180)}; argumento — ${curto(f.argumento, 160)}; oferta — ${curto(f.oferta, 140)}; por que vendeu — ${curto(f.por_que_funciona, 160)}. Em roteiro de venda e anúncio, parta deste modelo (as frases são nossas, pode reaproveitar; varie o gancho).`
  const { data } = await db.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle()
  if (!data) return
  const perfil = (data.perfil ?? {}) as Record<string, unknown>
  const memoria = ((Array.isArray(perfil.memoria) ? perfil.memoria : []) as { texto: string }[]).filter((m) => !m.texto.startsWith(marca))
  const nova = [...memoria, { texto, em: new Date().toISOString(), origem: 'resultado', fonte: 'criativo' }].slice(-40)
  await db.from('agentes_empresa').update({ perfil: { ...perfil, memoria: nova } }).eq('empresa_id', empresa).eq('agente_id', 'marketing')
}

type Criativo = { id: string; nome: string | null; texto: string | null; por_que: string | null; arquivos: { caminho: string; quadro?: boolean }[]; resultado: Record<string, unknown> | null }

export async function estudarCriativo(db: SupabaseClient, ia: Ia, empresa: string, id: string) {
  const { data } = await db.from('marca_referencias').select('id,nome,texto,por_que,arquivos,resultado').eq('id', id).eq('empresa_id', empresa).eq('categoria', 'nosso').maybeSingle()
  const c = data as Criativo | null
  if (!c) throw new Error('Criativo não encontrado.')
  if (!c.texto?.trim() && !c.arquivos?.length) throw new Error('Suba o vídeo do anúncio ou cole o texto dele.')
  await db.from('marca_referencias').update({ status: 'analisando', erro: null }).eq('id', id)
  try {
    const r = c.resultado ?? {}
    const usuario = [
      `CRIATIVO: ${c.nome ?? 'sem nome'}`,
      `RESULTADO: ${r.vendas ?? '?'} vendas, R$ ${r.receita ?? '?'} líquidos${r.campanha ? `, campanha "${r.campanha}"` : ''}${r.de ? `, de ${r.de} a ${r.ate}` : ''}${r.produtos ? `. Produto: ${r.produtos}` : ''}.`,
      c.por_que ? `O QUE A EQUIPE ACHA QUE FEZ VENDER: ${c.por_que}` : '',
      c.texto?.trim() ? `TRANSCRIÇÃO / TEXTO DO ANÚNCIO:\n${c.texto.trim().slice(0, 8000)}` : 'Sem transcrição.',
      'Decomponha o roteiro chamando a ferramenta entregar_roteiro.',
    ].filter(Boolean).join('\n\n')
    const quadros = await blocosDeQuadros(db, (c.arquivos ?? []).filter((a) => a.quadro).map((a) => a.caminho))
    const ficha = await ia(SISTEMA, [...quadros, { type: 'text', text: usuario }], FERRAMENTA, 'criativo', (e) => `Criativo ${c.nome ?? ''}: ${String(e.resumo ?? '')}`)
    if (!ficha?.resumo) throw new Error('O agente não devolveu a análise do roteiro. Tente de novo.')
    await db.from('marca_referencias').update({ ficha, status: 'pronta', atualizado_em: new Date().toISOString() }).eq('id', id)
    await ensinarMarketing(db, empresa, c.nome ?? 'criativo', r.vendas, ficha)
    return { ficha }
  } catch (e) {
    await db.from('marca_referencias').update({ status: 'erro', erro: (e as Error).message, atualizado_em: new Date().toISOString() }).eq('id', id)
    throw e
  }
}
