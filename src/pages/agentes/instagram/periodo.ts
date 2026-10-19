// Períodos da aba Período dos Resultados: atalhos (hoje, últimos 7 dias, esta semana, semana passada, últimos 30 dias,
// este mês, mês passado ou datas livres) e o período anterior usado na comparação. Dias no horário de Brasília.
import { crescimento, hojeBR, mediana, n, origemDe, somaDias, type DiaSeguidores, type PostIG } from './dados'

export type Atalho = 'hoje' | '7dias' | 'semana' | 'semana_passada' | '30dias' | 'mes' | 'mes_passado' | 'datas'
export type Intervalo = { de: string; ate: string; nome: string }

export const ATALHOS: { id: Atalho; nome: string }[] = [
  { id: 'hoje', nome: 'Hoje' }, { id: '7dias', nome: 'Últimos 7 dias' }, { id: 'semana', nome: 'Esta semana' }, { id: 'semana_passada', nome: 'Semana passada' },
  { id: '30dias', nome: 'Últimos 30 dias' }, { id: 'mes', nome: 'Este mês' }, { id: 'mes_passado', nome: 'Mês passado' }, { id: 'datas', nome: 'Escolher datas' },
]

export const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
export const textoIntervalo = (i: Pick<Intervalo, 'de' | 'ate'>) => (i.de === i.ate ? dm(i.de) : `${dm(i.de)} a ${dm(i.ate)}`)
const diasEntre = (de: string, ate: string) => Math.round((new Date(ate + 'T12:00:00Z').getTime() - new Date(de + 'T12:00:00Z').getTime()) / 86400000) + 1
// a semana começa no domingo e vai até o sábado
const domingoDa = (d: string) => somaDias(d, -new Date(d + 'T12:00:00Z').getUTCDay())
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()
const doisDig = (x: number) => String(x).padStart(2, '0')
function mesAntes(dia: string) {
  const ano = Number(dia.slice(0, 4)), mes = Number(dia.slice(5, 7))
  const a = mes === 1 ? ano - 1 : ano, m = mes === 1 ? 12 : mes - 1
  return { a, m, fim: `${a}-${doisDig(m)}-${doisDig(Math.min(Number(dia.slice(8, 10)), ultimoDiaDoMes(a, m)))}` }
}

// o período escolhido e o anterior para comparar (o mesmo tamanho logo antes; no mês, o mês anterior até o mesmo dia)
export function periodosDo(atalho: Atalho, datas: { de: string; ate: string }, hoje = hojeBR()): { atual: Intervalo; anterior: Intervalo } {
  const igual = (atual: Intervalo, nome: string): Intervalo => { const d = diasEntre(atual.de, atual.ate); return { de: somaDias(atual.de, -d), ate: somaDias(atual.de, -1), nome } }
  if (atalho === 'hoje') return { atual: { de: hoje, ate: hoje, nome: 'Hoje' }, anterior: { de: somaDias(hoje, -7), ate: somaDias(hoje, -7), nome: 'Mesmo dia da semana passada' } }
  if (atalho === '7dias') { const atual = { de: somaDias(hoje, -6), ate: hoje, nome: 'Últimos 7 dias' }; return { atual, anterior: igual(atual, '7 dias antes') } }
  if (atalho === '30dias') { const atual = { de: somaDias(hoje, -29), ate: hoje, nome: 'Últimos 30 dias' }; return { atual, anterior: igual(atual, '30 dias antes') } }
  if (atalho === 'semana') { const atual = { de: domingoDa(hoje), ate: hoje, nome: 'Esta semana' }; return { atual, anterior: { de: somaDias(atual.de, -7), ate: somaDias(hoje, -7), nome: 'Mesmos dias da semana passada' } } }
  if (atalho === 'semana_passada') { const de = somaDias(domingoDa(hoje), -7); const atual = { de, ate: somaDias(de, 6), nome: 'Semana passada' }; return { atual, anterior: igual(atual, 'Semana retrasada') } }
  if (atalho === 'mes') {
    const atual = { de: hoje.slice(0, 8) + '01', ate: hoje, nome: 'Este mês' }, ant = mesAntes(hoje)
    return { atual, anterior: { de: `${ant.a}-${doisDig(ant.m)}-01`, ate: ant.fim, nome: 'Mesmos dias do mês passado' } }
  }
  if (atalho === 'mes_passado') {
    const p = mesAntes(hoje), de = `${p.a}-${doisDig(p.m)}-01`, ate = `${p.a}-${doisDig(p.m)}-${doisDig(ultimoDiaDoMes(p.a, p.m))}`
    const r = mesAntes(de)
    return { atual: { de, ate, nome: 'Mês passado' }, anterior: { de: `${r.a}-${doisDig(r.m)}-01`, ate: `${r.a}-${doisDig(r.m)}-${doisDig(ultimoDiaDoMes(r.a, r.m))}`, nome: 'Mês retrasado' } }
  }
  const de = datas.de <= datas.ate ? datas.de : datas.ate, ate = datas.de <= datas.ate ? datas.ate : datas.de
  const atual = { de, ate, nome: textoIntervalo({ de, ate }) }
  return { atual, anterior: igual(atual, 'Mesmo número de dias antes') }
}

export const doIntervalo = (posts: PostIG[], i: Pick<Intervalo, 'de' | 'ate'>) =>
  posts.filter((p) => { const d = new Date(new Date(p.publicado_em).getTime() - 3 * 3600000).toISOString().slice(0, 10); return d >= i.de && d <= i.ate })

// os números de um conjunto de posts (e dos seguidores no intervalo)
export function numeros(ps: PostIG[], i: Pick<Intervalo, 'de' | 'ate'>, seguidores: DiaSeguidores[]) {
  const soma = (k: keyof PostIG['metricas']) => ps.reduce((s, p) => s + n(p, k), 0)
  const c = crescimento(seguidores, i.de, i.ate)
  return {
    posts: ps.length, alcance: soma('alcance'), mediana: mediana(ps.map((p) => n(p, 'alcance'))),
    salvos: soma('salvos'), compartilhamentos: soma('compartilhamentos'), curtidas: soma('curtidas'), comentarios: soma('comentarios'),
    seguidores: c.saldoDias ?? c.saldo ?? c.novos, seguidoresSaldo: c.saldoDias != null || c.saldo != null,
    doAgente: ps.filter((p) => origemDe(p) === 'agente').length,
  }
}
export type Numeros = ReturnType<typeof numeros>

// variação em % (null quando não dá para comparar)
export const variacao = (agora: number | null, antes: number | null) => (agora == null || antes == null || antes === 0 ? null : Math.round(((agora - antes) / antes) * 100))
