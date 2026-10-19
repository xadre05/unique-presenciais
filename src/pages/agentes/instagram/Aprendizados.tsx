// Aprendizados que o agente propõe numa análise: a equipe decide um por um (ensinar, editar antes de ensinar ou
// não concordar) ou ensina todos os que faltam de uma vez. O que é ensinado vai para a memória do agente e passa a
// valer em toda peça nova; a área "O que o agente aprendeu com os resultados" mostra e deixa tirar.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { desfazer, ensinar, ensinarVarios, pendentes, recusar, type AnaliseGuardada } from './analises'

type Props = { empresa: string; analise: AnaliseGuardada; aoMudar: () => void }

export function Aprendizados({ empresa, analise, aoMudar }: Props) {
  const [editando, setEditando] = useState<string | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const lista = analise.resultado.aprendizados ?? []
  const faltam = pendentes(analise)
  const texto = (t: string) => textos[t] ?? t
  const fazer = async (acao: () => Promise<unknown>) => {
    setErro(null); setOcupado(true)
    try { await acao(); setEditando(null); aoMudar() } catch (e) { setErro((e as Error).message) }
    setOcupado(false)
  }
  if (!lista.length) return null
  return (
    <div className="ap-bloco">
      <div className="ap-topo">
        <div><h5 className="reu-subtitulo">Ensinar o agente</h5>
          <span className="muted pequeno">Regras que o agente tirou destes números. Ensine as que você concorda: elas passam a valer em toda peça nova. Dá para editar antes.</span></div>
        {faltam.length > 1 && <button type="button" className="btn btn-ouro" disabled={ocupado} onClick={() => fazer(() => ensinarVarios(empresa, analise, faltam.map((t) => ({ original: t, texto: texto(t) }))))}>
          <Icone nome="check" tam={15} /> Ensinar os {faltam.length} que faltam</button>}
      </div>
      <ul className="ap-lista">{lista.map((t) => {
        const decisao = analise.decisoes?.[t]
        return (
          <li key={t} className={`ap-cartao${decisao ? ` ${decisao}` : ''}`}>
            {editando === t
              ? <textarea rows={3} value={texto(t)} onChange={(e) => setTextos((x) => ({ ...x, [t]: e.target.value }))} autoFocus aria-label="Editar aprendizado" />
              : <p>{texto(t)}</p>}
            <div className="ap-acoes">
              {decisao === 'ensinado' && <span className="ap-selo bom"><Icone nome="check" tam={14} /> Ensinado ao agente</span>}
              {decisao === 'recusado' && <><span className="ap-selo">Você não concordou</span>
                <button type="button" className="btn btn-mini" disabled={ocupado} onClick={() => fazer(() => desfazer(analise, t))}>Desfazer</button></>}
              {!decisao && <>
                <button type="button" className="btn btn-mini btn-ouro" disabled={ocupado || !texto(t).trim()} onClick={() => fazer(() => ensinar(empresa, analise, t, texto(t)))}><Icone nome="check" tam={13} /> Ensinar</button>
                {editando !== t && <button type="button" className="btn btn-mini" disabled={ocupado} onClick={() => setEditando(t)}><Icone nome="lapis" tam={13} /> Editar</button>}
                <button type="button" className="btn btn-mini" disabled={ocupado} onClick={() => fazer(() => recusar(analise, t))}><Icone nome="fechar" tam={13} /> Não concordo</button>
              </>}
            </div>
          </li>
        )
      })}</ul>
      {erro && <p className="erro-txt pequeno">{erro}</p>}
    </div>
  )
}
