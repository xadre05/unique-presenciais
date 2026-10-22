// Coluna da direita do Estúdio: a conversa com o agente. Cada versão é uma mensagem dele (o que fez) e cada pedido de
// ajuste é uma mensagem da equipe; V1, V2… trocam a versão da prévia. Embaixo, a conferência de qualidade da versão.
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Estudio } from './useEstudio'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function Qualidade({ e }: { e: Estudio }) {
  const linhas = (e.receita?.plano.checagem ?? '').split('\n').map((x) => x.replace(/^[-•\s]+/, '').trim()).filter(Boolean)
  const faltou = e.receita?.plano.faltou
  const pontos = linhas.filter((x) => /n[ãa]o |falt|sem /i.test(x)).length + (faltou ? 1 : 0)
  return (
    <section className="es-qualidade">
      <h4>Qualidade da prévia</h4>
      <p className="es-q"><Icone nome="check" tam={14} /> Áudio com limitador (sem estouro)</p>
      <p className="es-q">{e.hdr ? <><Icone nome="alerta" tam={14} /> Vídeo em HDR: <label><input type="checkbox" checked={e.corrigirHdr} onChange={(x) => e.setCorrigirHdr(x.target.checked)} /> corrigir brilho e cor</label></> : <><Icone nome="check" tam={14} /> Imagem sem ajuste necessário</>}</p>
      {(e.receita?.plano.cenas ?? []).map((c, k) => (
        <p key={k} className={`es-q${c.erro ? ' alerta' : ''}`} title={c.descricao}><Icone nome={c.erro ? 'alerta' : 'check'} tam={14} /> Cena animada {k + 1}: {c.erro ? `não entrou (${c.erro.slice(0, 80)})` : c.nota ? `nota ${c.nota} na revisão` : 'pronta'}</p>
      ))}
      {(e.receita?.plano.beats ?? []).length > 0 && (
        <details>
          <summary className="es-q"><Icone nome="lista" tam={14} /> Plano da edição: {(e.receita?.plano.beats ?? []).map((b) => b.nome).join(' → ')}</summary>
          <ul className="muted pequeno">{(e.receita?.plano.beats ?? []).map((b, k) => <li key={k}><b>{b.nome}</b>{b.tratamento ? `: ${b.tratamento}` : ''}</li>)}</ul>
        </details>
      )}
      {linhas.length > 0 && (
        <details>
          <summary className={pontos ? 'es-q alerta' : 'es-q'}><Icone nome={pontos ? 'alerta' : 'check'} tam={14} /> {pontos ? `${pontos} ponto(s) para revisar` : 'Padrão de edição conferido'}</summary>
          <ul className="muted pequeno">{linhas.map((l) => <li key={l}>{l}</li>)}{faltou && <li>{faltou}</li>}</ul>
        </details>
      )}
    </section>
  )
}

export function PainelAjustes({ e }: { e: Estudio }) {
  const [pedido, setPedido] = useState('')
  const [regra, setRegra] = useState(false)
  const enviar = async () => { const p = pedido; setPedido(''); await e.ajustar(p, regra); setRegra(false) }
  return (
    <aside className="es-ajustes">
      <h3>Ajustes com o agente</h3>
      <p className="muted pequeno">Peça alterações e veja a prévia atualizada.</p>
      {e.receitas.length > 0 && <div className="es-versoes">{e.receitas.map((r, k) => (
        <button key={r.em} type="button" className={k === e.versao ? 'ativa' : ''} onClick={() => e.setVersao(k)}>V{k + 1}</button>))}</div>}
      <div className="es-conversa">
        {e.receitas.map((r, k) => (
          <div key={r.em}>
            {r.pedido && <div className="es-msg eu"><span className="es-msg-quem">Você</span><p>{r.pedido}</p></div>}
            <div className={`es-msg agente${k === e.versao ? ' atual' : ''}`}>
              <img src="/agentes/editor-avatar.webp?v=1" alt="" onError={(x) => { (x.target as HTMLImageElement).style.display = 'none' }} />
              <div><span className="es-msg-quem">Agente Editor · V{k + 1} · {hora(r.em)}</span><p>{r.plano.resumo ?? 'Edição pronta.'}</p>
                {r.plano.roteiro_identificado && r.plano.roteiro_identificado !== 'nenhum' && <p className="muted pequeno">Roteiro reconhecido: {r.plano.roteiro_identificado}</p>}</div>
            </div>
          </div>
        ))}
        {e.ocupado && <div className="es-msg agente"><div><span className="es-msg-quem">Agente Editor</span><p className="muted">{e.ocupado}</p></div></div>}
      </div>
      <div className="es-pedido">
        <textarea rows={3} value={pedido} onChange={(x) => setPedido(x.target.value)} placeholder="O que você quer mudar?" disabled={!e.receita || !!e.ocupado}
          onKeyDown={(x) => { if (x.key === 'Enter' && !x.shiftKey && pedido.trim()) { x.preventDefault(); void enviar() } }} />
        <button type="button" className="btn btn-ouro btn-mini" disabled={!pedido.trim() || !e.receita || !!e.ocupado} onClick={() => void enviar()}><Icone nome="enviar" tam={14} /> Enviar</button>
      </div>
      <label className="pequeno es-regra"><input type="checkbox" checked={regra} onChange={(x) => setRegra(x.target.checked)} /> Vale como regra para os próximos vídeos</label>
      {e.receita && <Qualidade e={e} />}
    </aside>
  )
}
