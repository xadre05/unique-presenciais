// Visão geral do ecossistema: as fases da esquerda para a direita, os épicos de cada uma e quanto já foi entregue.
import { KpiIcone } from '../../../components/ui'
import { Badge } from '../../../components/ui'
import { FASES, STATUS_EPICO, domingoDe, progressoEpico, type UsoProjeto } from './dados'

export function VisaoGeral({ uso, abrirEpico, irPara }: { uso: UsoProjeto; abrirEpico: (id: string) => void; irPara: (aba: string) => void }) {
  const p = uso.dados!
  const domingo = domingoDe()
  const publicadas = p.entregas.filter((e) => e.status === 'publicado').length
  const naSemana = p.entregas.filter((e) => ['semana', 'construindo'].includes(e.status)).length
  const testar = p.entregas.filter((e) => e.status === 'testar').length
  const ideias = p.ideias.filter((i) => i.status === 'nova').length
  const publicadasSemana = p.entregas.filter((e) => e.status === 'publicado' && (e.publicado_em ?? '') >= domingo).length
  const fases = [...new Set([...Object.keys(FASES).map(Number), ...p.epicos.map((e) => e.fase)])].sort((a, b) => a - b)

  return (
    <section>
      <div className="kpis prj-kpis">
        <button className="prj-kpi-btn" onClick={() => irPara('semana')}><KpiIcone icone="raio" rotulo="Sendo feitas" valor={String(naSemana)} sub="entregas desta semana" destaque /></button>
        <button className="prj-kpi-btn" onClick={() => irPara('semana')}><KpiIcone icone="check" rotulo="Para você testar" valor={String(testar)} sub={testar ? 'esperando sua aprovação' : 'nada esperando você'} tom={testar ? 'alerta' : undefined} /></button>
        <KpiIcone icone="enviar" rotulo="Publicadas" valor={String(publicadas)} sub={`${publicadasSemana} nesta semana`} tom="ok" />
        <button className="prj-kpi-btn" onClick={() => irPara('ideias')}><KpiIcone icone="ideia" rotulo="Ideias novas" valor={String(ideias)} sub={ideias ? 'esperando triagem' : 'caixa vazia'} /></button>
      </div>

      <div className="prj-fases">
        {fases.map((f) => {
          const epicos = p.epicos.filter((e) => e.fase === f)
          return (
            <div key={f} className="prj-fase">
              <div className="prj-fase-topo"><span className="prj-fase-num">Fase {f}</span><b>{FASES[f]?.nome ?? 'Outros'}</b><span className="muted pequeno">{FASES[f]?.quando}</span></div>
              <div className="prj-fase-epicos">
              {epicos.length === 0 && <p className="muted pequeno">Nenhum épico ainda.</p>}
              {epicos.map((e) => {
                const pr = progressoEpico(e, p.entregas)
                const ativas = p.entregas.filter((x) => x.epico_id === e.id && ['semana', 'construindo', 'testar'].includes(x.status)).length
                return (
                  <button key={e.id} className={`prj-epico prj-epico-${e.status}`} onClick={() => abrirEpico(e.id)}>
                    <b className="prj-epico-nome">{e.nome}</b>
                    <span><Badge tom={STATUS_EPICO[e.status].tom}>{STATUS_EPICO[e.status].rotulo}</Badge></span>
                    {e.descricao && <span className="muted pequeno prj-epico-desc">{e.descricao}</span>}
                    <span className="prj-barra"><span style={{ width: `${pr.total ? (100 * pr.feitas) / pr.total : 0}%` }} /></span>
                    <span className="muted pequeno">{pr.feitas} de {pr.total} entregas publicadas{ativas ? ` · ${ativas} em andamento` : ''}</span>
                  </button>
                )
              })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
