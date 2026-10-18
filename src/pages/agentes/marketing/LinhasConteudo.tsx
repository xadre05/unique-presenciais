// "O que vamos criar?": uma linha por canal + formato, com quantidade e os campos próprios do formato
// (telas para stories, duração para vídeo) e, em semana/período, em quais dias da semana.
import { InputNumero } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { DURACOES, LISTA_REDES, REDES, ehVideo, nomeFormato, type Formato, type Rede } from './redes'

export type LinhaConteudo = { id: string; rede: Rede; formato: Formato; qtd: number; diasSemana: number[]; telas: number; duracao: string }
const TODOS_OS_DIAS = [1, 2, 3, 4, 5, 6, 0]
const NOME_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function novaLinha(rede: Rede = 'instagram', formato?: Formato): LinhaConteudo {
  const f = formato ?? REDES[rede].formatos[0]
  // stories todo dia; o resto em dias alternados (segunda, quarta e sexta) — dá para mudar nos botões de dia
  return { id: crypto.randomUUID(), rede, formato: f, qtd: 1, diasSemana: f === 'stories' ? [...TODOS_OS_DIAS] : [1, 3, 5], telas: 5, duracao: DURACOES[f]?.[1] ?? '' }
}

export function LinhasConteudo({ linhas, mudar, unica, porSemana }: { linhas: LinhaConteudo[]; mudar: (l: LinhaConteudo[]) => void; unica: boolean; porSemana: boolean }) {
  const muda = (id: string, c: Partial<LinhaConteudo>) => mudar(linhas.map((l) => (l.id === id ? { ...l, ...c } : l)))
  const trocarRede = (l: LinhaConteudo, r: Rede) => {
    const f = REDES[r].formatos.includes(l.formato) ? l.formato : REDES[r].formatos[0]
    muda(l.id, { rede: r, formato: f, duracao: DURACOES[f]?.[1] ?? '' })
  }
  const alternarDia = (l: LinhaConteudo, d: number) => muda(l.id, { diasSemana: l.diasSemana.includes(d) ? l.diasSemana.filter((x) => x !== d) : [...l.diasSemana, d] })
  return (
    <div className={`mk-linhas${unica ? ' unica' : ''}`}>
      <div className="mk-linha mk-linha-cab"><span>Canal</span><span>Formato</span>{!unica && <span>{porSemana ? 'Por dia' : 'Quantidade'}</span>}<span>Detalhes</span><span /></div>
      {linhas.map((l) => (
        <div key={l.id} className="mk-linha-bloco">
          <div className="mk-linha">
            <select value={l.rede} onChange={(e) => trocarRede(l, e.target.value as Rede)} style={{ ['--cor-rede' as string]: REDES[l.rede].cor }} className="mk-sel-rede">
              {LISTA_REDES.map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}
            </select>
            <select value={l.formato} onChange={(e) => { const f = e.target.value as Formato; muda(l.id, { formato: f, duracao: DURACOES[f]?.[1] ?? '' }) }}>
              {REDES[l.rede].formatos.map((f) => <option key={f} value={f}>{nomeFormato(f, l.rede)}</option>)}
            </select>
            {!unica && <InputNumero valor={l.qtd} min={1} max={5} onChange={(v) => muda(l.id, { qtd: v ?? 1 })} />}
            <span className="mk-linha-det">
              {l.formato === 'stories' && <label>Telas<InputNumero valor={l.telas} min={2} max={15} onChange={(v) => muda(l.id, { telas: v ?? 5 })} /></label>}
              {ehVideo(l.formato) && <label>Duração<select value={l.duracao} onChange={(e) => muda(l.id, { duracao: e.target.value })}>{(DURACOES[l.formato] ?? []).map((d) => <option key={d}>{d}</option>)}</select></label>}
            </span>
            {!unica && linhas.length > 1 ? <button type="button" className="mk-tirar" title="Tirar esta linha" onClick={() => mudar(linhas.filter((x) => x.id !== l.id))}><Icone nome="fechar" tam={16} /></button> : <span />}
          </div>
          {porSemana && (
            <div className="mk-dias-semana"><span className="muted pequeno">Em quais dias:</span>{TODOS_OS_DIAS.map((d) => (
              <button key={d} type="button" className={`mk-chip mini${l.diasSemana.includes(d) ? ' ativo' : ''}`} onClick={() => alternarDia(l, d)}>{NOME_DIA[d]}</button>
            ))}</div>
          )}
        </div>
      ))}
      {!unica && <button type="button" className="btn btn-contorno-ouro btn-mini mk-add-linha" onClick={() => mudar([...linhas, novaLinha(linhas.at(-1)?.rede === 'instagram' ? 'youtube' : linhas.at(-1)?.rede === 'youtube' ? 'tiktok' : 'instagram')])}><Icone nome="mais" tam={14} /> Adicionar canal ou formato</button>}
    </div>
  )
}
