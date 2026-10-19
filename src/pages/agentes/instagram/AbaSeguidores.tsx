// Resultados → Seguidores: quantos entraram, quantos saíram e o saldo real (7 e 30 dias), o gráfico de entradas e saídas
// por dia (últimos 30 dias) e a linha do total desde que o registro começou. O Instagram leva até 2 dias para fechar os
// números de um dia: esses dias aparecem como "sem número ainda", que é diferente de zero.
import { useState } from 'react'
import { comSinal, crescimento, hojeBR, milhar, somaDias, type DiaSeguidores } from './dados'
import { EntradasSaidas, Linha, type Ponto, type PontoDuplo } from './Graficos'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const numero = (v: number | null) => (v == null ? 'sem número ainda' : milhar(v))

function dicaDoDia(d: string, x?: DiaSeguidores) {
  const e = x?.novos ?? null, s = x?.saidas ?? null
  const saldo = e != null && s != null ? ` · saldo ${comSinal(e - s)}` : ''
  return `${SEMANA[new Date(d + 'T12:00:00Z').getUTCDay()]}: entraram ${numero(e)} · saíram ${numero(s)}${saldo}`
}

// entraram, saíram e saldo de um intervalo, contando só os dias com número (e quantos dias têm)
function resumo(h: DiaSeguidores[], de: string, ate: string, dias: number) {
  const c = crescimento(h, de, ate)
  const doIntervalo = h.filter((x) => x.dia >= de && x.dia <= ate)
  const sairam = doIntervalo.filter((x) => x.saidas != null).reduce((s, x) => s + Number(x.saidas), 0)
  return { entraram: c.novos, sairam, saldo: c.saldoDias, diasCompletos: c.diasCompletos, dias }
}

function CartaoSaldo({ rotulo, r }: { rotulo: string; r: ReturnType<typeof resumo> }) {
  return (
    <div className="pe-cartao"><small>{rotulo}</small>
      <b className={r.saldo == null ? '' : r.saldo >= 0 ? 'ig-acima' : 'ig-abaixo'}>{r.saldo == null ? '—' : comSinal(r.saldo)}</b>
      <small className="muted">entraram +{milhar(r.entraram ?? 0)} · saíram −{milhar(r.sairam)}</small>
      {r.diasCompletos < r.dias && <small className="muted sg-dias">{r.diasCompletos} de {r.dias} dias com número (os mais recentes ainda fechando)</small>}
    </div>
  )
}

export function AbaSeguidores({ historico, atual }: { historico: DiaSeguidores[]; atual: number | null }) {
  const [hoje] = useState(hojeBR)
  const porDia = new Map(historico.map((x) => [x.dia, x]))
  const dias = Array.from({ length: 30 }, (_, i) => somaDias(hoje, i - 29))
  const pontos: PontoDuplo[] = dias.map((d) => ({ rotulo: dm(d), entraram: porDia.get(d)?.novos ?? null, sairam: porDia.get(d)?.saidas ?? null, dica: dicaDoDia(d, porDia.get(d)) }))
  const totais: Ponto[] = historico.filter((x) => x.seguidores != null).map((x) => ({ rotulo: dm(x.dia), valor: x.seguidores, dica: `${milhar(x.seguidores ?? undefined)} seguidores` }))
  const r7 = resumo(historico, somaDias(hoje, -6), hoje, 7), r30 = resumo(historico, somaDias(hoje, -29), hoje, 30)
  const porDiaSaem = r30.diasCompletos ? Math.round(r30.sairam / r30.diasCompletos) : null
  const porDiaEntram = r30.diasCompletos && r30.entraram != null ? Math.round(r30.entraram / Math.max(1, r30.diasCompletos)) : null
  const primeira = historico.find((x) => x.seguidores != null)
  return (
    <div className="sg-aba">
      <div className="pe-cartoes">
        <div className="pe-cartao"><small>Seguidores agora</small><b>{milhar(atual ?? undefined)}</b><small className="muted">lido todo dia às 6h</small></div>
        <CartaoSaldo rotulo="Saldo nos últimos 7 dias" r={r7} />
        <CartaoSaldo rotulo="Saldo nos últimos 30 dias" r={r30} />
        <div className="pe-cartao"><small>Por dia, em média (30 dias)</small><b>{porDiaEntram == null ? '—' : `+${porDiaEntram} / −${porDiaSaem}`}</b><small className="muted">entram / saem</small></div>
      </div>
      <section className="mk-painel pe-bloco">
        <h4 className="pe-titulo">Entraram e saíram por dia <span className="muted pequeno">(últimos 30 dias)</span></h4>
        <EntradasSaidas pontos={pontos} titulo="Seguidores que entraram e que saíram por dia nos últimos 30 dias" />
        <p className="muted pequeno">Números do Instagram: quem começou a seguir e quem deixou de seguir (ou apagou a conta) em cada dia. O Instagram leva até 2 dias para fechar um dia; até lá ele aparece como "sem número ainda", que é diferente de zero.</p>
      </section>
      <section className="mk-painel pe-bloco">
        <h4 className="pe-titulo">Total de seguidores</h4>
        {totais.length >= 2 ? <Linha pontos={totais} titulo="Total de seguidores por dia" />
          : <p className="muted pequeno">O total é guardado uma vez por dia desde {primeira ? dm(primeira.dia) : 'hoje'} ({milhar(primeira?.seguidores ?? undefined)}). A linha aparece a partir da segunda leitura.</p>}
      </section>
    </div>
  )
}
