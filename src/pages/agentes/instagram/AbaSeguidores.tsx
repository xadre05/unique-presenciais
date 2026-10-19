// Resultados → Seguidores: cartões (agora, novos em 7 e 30 dias, média por dia e, quando houver duas fotos do total,
// o saldo), o gráfico de novos seguidores por dia (últimos 30 dias) e a linha do total desde que o registro começou.
// O Instagram leva até 2 dias para fechar os novos de um dia: esses dias aparecem como "fechando".
import { useState } from 'react'
import { comSinal, crescimento, hojeBR, milhar, somaDias, type DiaSeguidores } from './dados'
import { Colunas, Linha, type Ponto } from './Graficos'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function AbaSeguidores({ historico, atual }: { historico: DiaSeguidores[]; atual: number | null }) {
  const [hoje] = useState(hojeBR)
  const porDia = new Map(historico.map((x) => [x.dia, x]))
  const dias = Array.from({ length: 30 }, (_, i) => somaDias(hoje, i - 29))
  const novos: Ponto[] = dias.map((d) => {
    const v = porDia.get(d)?.novos ?? null
    const fechando = v == null && d >= somaDias(hoje, -2)
    return { rotulo: dm(d), valor: v, dica: v != null ? `${SEMANA[new Date(d + 'T12:00:00Z').getUTCDay()]}: ${milhar(v)} novos seguidores` : fechando ? 'O Instagram ainda está fechando este dia (leva até 2 dias)' : 'Sem número do Instagram para este dia' }
  })
  const totais: Ponto[] = historico.filter((x) => x.seguidores != null).map((x) => ({ rotulo: dm(x.dia), valor: x.seguidores, dica: `${milhar(x.seguidores ?? undefined)} seguidores` }))
  const soma = (de: string) => historico.filter((x) => x.dia >= de && x.novos != null).reduce((s, x) => s + Number(x.novos), 0)
  const n7 = soma(somaDias(hoje, -6)), n30 = soma(somaDias(hoje, -29))
  const diasCom30 = historico.filter((x) => x.dia >= somaDias(hoje, -29) && x.novos != null).length
  const primeira = historico.find((x) => x.seguidores != null)
  const saldo = primeira ? crescimento(historico, primeira.dia, hoje) : null
  return (
    <div className="sg-aba">
      <div className="pe-cartoes">
        <div className="pe-cartao"><small>Seguidores agora</small><b>{milhar(atual ?? undefined)}</b><small className="muted">lido todo dia às 6h</small></div>
        <div className="pe-cartao"><small>Novos nos últimos 7 dias</small><b>+{milhar(n7)}</b><small className="muted">segundo o Instagram</small></div>
        <div className="pe-cartao"><small>Novos nos últimos 30 dias</small><b>+{milhar(n30)}</b><small className="muted">média de {milhar(Math.round(n30 / Math.max(1, diasCom30)))} por dia</small></div>
        <div className="pe-cartao"><small>Saldo desde {primeira ? dm(primeira.dia) : '—'}</small><b>{saldo?.saldo != null ? comSinal(saldo.saldo) : '—'}</b><small className="muted">{saldo?.saldo != null ? 'ganhos menos quem deixou de seguir' : 'aparece a partir da 2ª leitura (amanhã)'}</small></div>
      </div>
      <section className="mk-painel pe-bloco">
        <h4 className="pe-titulo">Novos seguidores por dia <span className="muted pequeno">(últimos 30 dias)</span></h4>
        <Colunas pontos={novos} titulo="Novos seguidores por dia nos últimos 30 dias" />
        <p className="muted pequeno">O Instagram informa quantos começaram a seguir em cada dia, mas não desconta quem deixou de seguir, e leva até 2 dias para fechar o número. Os dias marcados com um traço na base ainda estão fechando.</p>
      </section>
      <section className="mk-painel pe-bloco">
        <h4 className="pe-titulo">Total de seguidores</h4>
        {totais.length >= 2 ? <Linha pontos={totais} titulo="Total de seguidores por dia" />
          : <p className="muted pequeno">O total é guardado uma vez por dia desde {primeira ? dm(primeira.dia) : 'hoje'} ({milhar(primeira?.seguidores ?? undefined)}). A linha aparece a partir da segunda leitura e mostra o saldo real: quem entrou menos quem saiu.</p>}
      </section>
    </div>
  )
}
