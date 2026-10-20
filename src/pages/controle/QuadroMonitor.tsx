// Quadro "Conferido sozinho": resultado do monitor automático (a cada 30 min) com botão para conferir agora.
import { useState } from 'react'
import { Badge, Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { dataHoraBR } from '../../lib/format'
import { NOME_NIVEL, NOME_TIPO, TOM_NIVEL, haQuanto, useMonitores, verificarAgora } from './monitores'

export function QuadroMonitor() {
  const q = useMonitores()
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const conferir = async () => {
    setRodando(true); setErro(null)
    try { await verificarAgora(); await q.recarregar(); setAgora(Date.now()) } catch (e) { setErro((e as Error).message) }
    setRodando(false)
  }
  const lista = q.dados ?? []
  return (
    <section className="bloco ctl-monitor">
      <header className="ctl-monitor-cab">
        <div><h2>Conferido sozinho</h2><p className="muted pequeno">O sistema confere a cada 30 minutos se cada coisa está no ar (domínios, a cada 6 horas). Ninguém precisa preencher nada.</p></div>
        <button className="btn btn-contorno-ouro" onClick={conferir} disabled={rodando}><Icone nome="atualizar" tam={16} /> {rodando ? 'Conferindo…' : 'Conferir agora'}</button>
      </header>
      <Erro msg={q.erro || erro} />
      {q.carregando && !q.dados ? <Vazio>Carregando…</Vazio> : (
        <ul className="ctl-monitor-lista">{lista.map((m) => (
          <li key={m.id} className={`ctl-mon ctl-mon-${m.nivel ?? 'nada'}`}>
            <div className="ctl-mon-nome"><b>{m.nome}</b><small className="muted">{NOME_TIPO[m.tipo] ?? m.tipo}</small></div>
            <div className="ctl-mon-detalhe">{m.detalhe ?? 'Ainda não verificado'}</div>
            <div className="ctl-mon-estado">
              {m.nivel ? <Badge tom={TOM_NIVEL[m.nivel]}>{NOME_NIVEL[m.nivel]}</Badge> : <Badge>Aguardando</Badge>}
              <small className="muted" title={m.verificado_em ? `Verificado em ${dataHoraBR(m.verificado_em)}` : ''}>{haQuanto(m.verificado_em, agora)}</small>
            </div>
          </li>
        ))}</ul>
      )}
    </section>
  )
}
