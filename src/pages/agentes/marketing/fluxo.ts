// Fluxo de trabalho do conteúdo, como numa agência: a social media (o Agente de Marketing, com o nome que a empresa
// der) planeja; alguém aprova a pauta; quem grava recebe o que gravar e o prazo; o vídeo enviado cai na fila do
// Editor; a edição volta para aprovação; aprovado, agenda. Tudo calculado do que já está na peça (sem banco novo).
// Os mesmos avisos aparecem na Sala e, quando o WhatsApp estiver ligado, vão para o celular de cada pessoa.
import type { Peca } from '../comum'
import { edicaoDa } from './edicao/dados'
import { configDaPeca, ehAvulso } from './peca/editor'
import { estagioDe } from './peca/progresso'

export type Fluxo = {
  apelido: string
  grava: string[]           // quem grava os vídeos (ids de perfis)
  aprova_pauta: string[]    // quem aprova o texto/roteiro
  aprova_edicao: string[]   // quem aprova o vídeo editado
  dias_antes: number        // o vídeo precisa chegar quantos dias antes da data do post
  telefones: Record<string, string> // WhatsApp de cada pessoa (para os avisos, quando o WhatsApp estiver ligado)
}
export const FLUXO_PADRAO: Fluxo = { apelido: 'Júlia', grava: [], aprova_pauta: [], aprova_edicao: [], dias_antes: 2, telefones: {} }
export const fluxoDe = (perfil?: Record<string, unknown> | null): Fluxo => ({ ...FLUXO_PADRAO, ...((perfil?.fluxo ?? {}) as Partial<Fluxo>) })

// partes: o vídeo sobe em pedaços de até 40 MB (o armazenamento aceita até 50 MB por arquivo); caminho é o da parte 0
export type Bruto = { caminho: string; nome: string; tamanho: number; em: string; por?: string; partes?: string[] }
export const brutoDe = (p: Peca) => (p.conteudo as { bruto?: Bruto }).bruto

export type Passo = 'pauta' | 'gravar' | 'edicao' | 'aprovar_edicao' | 'producao' | 'final' | 'pronto' | 'publicado' | 'ideia' | 'descartada'
export const NOME_PASSO: Record<Passo, string> = {
  ideia: 'Ideia', pauta: 'Pauta para aprovar', gravar: 'Para gravar', edicao: 'Na fila de edição', aprovar_edicao: 'Edição para aprovar',
  producao: 'Em produção', final: 'Revisão final', pronto: 'Aprovado', publicado: 'Publicado', descartada: 'Fora do planejamento',
}

const ehVideo = (p: Peca) => p.tipo === 'reels' || p.tipo === 'video'
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
const menosDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10)

export function passoDe(p: Peca): Passo {
  const s = estagioDe(p)
  if (s === 'texto') return 'pauta'
  if (s !== 'producao') return s
  if (!ehVideo(p) || !configDaPeca(p).etapa2 || ehAvulso(p)) return 'producao'
  const e = edicaoDa(p.conteudo)
  if (e.receitas?.length) return 'aprovar_edicao'
  if (brutoDe(p) || e.arquivo || e.palavras?.length) return 'edicao'
  return 'gravar'
}

// prazo do vídeo chegar (só no passo "gravar"): a data do post menos os dias combinados
export function prazoGravacao(p: Peca, f: Fluxo) {
  return p.dia ? menosDias(p.dia, f.dias_antes) : null
}
export const atrasado = (p: Peca, f: Fluxo) => { const pz = prazoGravacao(p, f); return passoDe(p) === 'gravar' && !!pz && pz < hojeBR() }
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// ===== avisos da social media (iguais na Sala e no WhatsApp) =====
export type Aviso = { tom: 'alerta' | 'acao' | 'ok'; texto: string; link: string; para: 'grava' | 'pauta' | 'edicao' | 'todos' }
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

export function avisos(pecas: Peca[], f: Fluxo, quem?: string): Aviso[] {
  const hoje = hojeBR()
  const ativas = pecas.filter((p) => passoDe(p) !== 'descartada')
  const por = (x: Passo) => ativas.filter((p) => passoDe(p) === x)
  const lista: Aviso[] = []
  const atrasados = por('gravar').filter((p) => atrasado(p, f))
  const paraGravar = por('gravar').filter((p) => !atrasado(p, f))
  for (const p of atrasados.slice(0, 3)) lista.push({ tom: 'alerta', para: 'grava', link: '/agentes/gravar', texto: `O vídeo "${p.titulo}" era para chegar até ${dm(prazoGravacao(p, f)!)} e ainda não chegou.` })
  if (atrasados.length > 3) lista.push({ tom: 'alerta', para: 'grava', link: '/agentes/gravar', texto: `E mais ${plural(atrasados.length - 3, 'vídeo atrasado', 'vídeos atrasados')}.` })
  if (paraGravar.length) {
    const prox = paraGravar.map((p) => prazoGravacao(p, f)).filter(Boolean).sort()[0]
    lista.push({ tom: 'acao', para: 'grava', link: '/agentes/gravar', texto: `${plural(paraGravar.length, 'vídeo para gravar', 'vídeos para gravar')}${prox ? `; o primeiro precisa chegar até ${dm(prox)}` : ''}.` })
  }
  const pautas = por('pauta').length
  if (pautas) lista.push({ tom: 'acao', para: 'pauta', link: '/agentes/marketing', texto: `${plural(pautas, 'pauta esperando', 'pautas esperando')} aprovação.` })
  const edicoes = por('aprovar_edicao').length
  if (edicoes) lista.push({ tom: 'acao', para: 'edicao', link: '/agentes/editor', texto: `${plural(edicoes, 'edição pronta', 'edições prontas')} para aprovar.` })
  const finais = por('final').length
  if (finais) lista.push({ tom: 'acao', para: 'pauta', link: '/agentes/marketing', texto: `${plural(finais, 'peça na', 'peças na')} revisão final antes de agendar.` })
  // semana sem plano: menos de 3 peças nos próximos 7 dias
  const em7 = menosDias(hoje, -7)
  const proximas = ativas.filter((p) => p.dia && p.dia >= hoje && p.dia <= em7).length
  if (proximas < 3) lista.push({ tom: 'acao', para: 'todos', link: '/agentes/marketing?modo=semana', texto: proximas ? `Só ${plural(proximas, 'post planejado', 'posts planejados')} para os próximos 7 dias. Vamos planejar a semana?` : 'Não tem nada planejado para os próximos 7 dias. Vamos planejar a semana?' })
  if (!quem) return lista
  // cada pessoa vê o que é dela (sem ninguém marcado num papel, todo mundo vê)
  const meu = (papel: Aviso['para']) => papel === 'todos' || (papel === 'grava' ? !f.grava.length || f.grava.includes(quem)
    : papel === 'pauta' ? !f.aprova_pauta.length || f.aprova_pauta.includes(quem) : !f.aprova_edicao.length || f.aprova_edicao.includes(quem))
  return lista.filter((a) => meu(a.para))
}
