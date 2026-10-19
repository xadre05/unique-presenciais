// Base da marca → Referências para modelar: o que a equipe guarda de TERCEIROS para o agente aprender formatos
// (concorrentes, outros nichos, quem admiramos, materiais comprados). Separado da Biblioteca da marca, que é o
// conhecimento da própria empresa. As fichas entram na reunião de pauta e na escrita das peças do mesmo formato.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { Miniatura } from '../marketing/peca/arquivos'
import { CATEGORIAS, mudarReferencia, nomeCategoria, nomeFormato, pedirFicha, useReferencias, type Categoria, type Referencia } from './dados'
import { NovaReferencia } from './NovaReferencia'
import { FichaReferencia } from './FichaReferencia'

const STATUS: Record<Referencia['status'], string> = { nova: 'Ainda não estudada', analisando: 'O agente está estudando…', pronta: 'Aprendido', erro: 'Não deu certo' }

function Cartao({ empresa, r, aoMudou }: { empresa: string; r: Referencia; aoMudou: () => void }) {
  const [aberta, setAberta] = useState(false)
  const [tirar, setTirar] = useState(false)
  const [estudando, setEstudando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const estudar = async () => {
    setErro(null); setEstudando(true)
    try { await pedirFicha(empresa, r.id); setAberta(true) } catch (e) { setErro((e as Error).message) }
    setEstudando(false); aoMudou()
  }
  const confirmarTirar = async () => { try { await mudarReferencia(r.id, { ativo: false }); aoMudou() } catch (e) { setErro((e as Error).message) } }
  const capa = r.arquivos[0]
  return (
    <li className="ref-cartao">
      <div className="ref-capa">{capa ? <Miniatura caminho={capa.caminho} nome={capa.nome} /> : <span className="ref-sem-capa"><Icone nome="texto" tam={20} /></span>}</div>
      <div className="ref-corpo">
        <div className="ref-titulo"><b>{nomeFormato(r.formato)}{r.autor ? ` · ${r.autor}` : ''}</b>
          <span className="badge">{nomeCategoria(r.categoria)}</span>
          <span className={`badge ${r.status === 'pronta' ? 'badge-ok' : r.status === 'erro' ? 'badge-erro' : 'badge-info'}`}>{estudando ? STATUS.analisando : STATUS[r.status]}</span></div>
        {r.ficha?.resumo && <p>{r.ficha.resumo}</p>}
        {r.por_que && <small className="muted">Copiar daqui: {r.por_que}</small>}
        {r.status === 'erro' && r.erro && <small className="ref-erro">{r.erro}</small>}
        {aberta && r.ficha && <FichaReferencia ficha={r.ficha} />}
        <div className="ia-linha">
          {r.ficha && <button type="button" className="btn btn-mini" onClick={() => setAberta(!aberta)}>{aberta ? 'Fechar' : 'Ver o que ele aprendeu'}</button>}
          {(r.status === 'erro' || r.status === 'nova') && <button type="button" className="btn btn-mini" disabled={estudando} onClick={estudar}><Icone nome="atualizar" tam={13} /> Estudar de novo</button>}
          {r.link && <a className="btn btn-mini" href={r.link} target="_blank" rel="noreferrer"><Icone nome="globo" tam={13} /> Abrir</a>}
          {r.arquivos.length > 1 && <span className="muted pequeno">{r.arquivos.length} imagens</span>}
          {tirar ? <><span className="pequeno">Tirar esta referência?</span><button type="button" className="btn btn-mini" onClick={confirmarTirar}>Sim, tirar</button><button type="button" className="btn btn-mini" onClick={() => setTirar(false)}>Não</button></>
            : <button type="button" className="btn btn-mini" onClick={() => setTirar(true)}><Icone nome="lixeira" tam={13} /> Tirar</button>}
        </div>
        <Erro msg={erro} />
      </div>
    </li>
  )
}

export function ReferenciasMarca({ empresa }: { empresa: string }) {
  const refs = useReferencias(empresa)
  const [filtro, setFiltro] = useState<Categoria | 'todas'>('todas')
  const [nova, setNova] = useState(false)
  const lista = refs.dados ?? []
  const visiveis = filtro === 'todas' ? lista : lista.filter((r) => r.categoria === filtro)
  const conta = (c: Categoria) => lista.filter((r) => r.categoria === c).length
  return (
    <div className="ref">
      <div className="ia-linha">
        <button type="button" className={`mk-chip${filtro === 'todas' ? ' ativo' : ''}`} onClick={() => setFiltro('todas')}>Todas ({lista.length})</button>
        {CATEGORIAS.filter((c) => conta(c.id)).map((c) => <button key={c.id} type="button" className={`mk-chip${filtro === c.id ? ' ativo' : ''}`} onClick={() => setFiltro(c.id)}>{c.nome} ({conta(c.id)})</button>)}
        {!nova && <button type="button" className="btn btn-contorno-ouro ref-nova" onClick={() => setNova(true)}><Icone nome="mais" tam={15} /> Nova referência</button>}
      </div>
      {nova && <NovaReferencia empresa={empresa} aoGuardar={refs.recarregar} aoCancelar={() => setNova(false)} />}
      <Erro msg={refs.erro} />
      {visiveis.length ? <ul className="ref-lista">{visiveis.map((r) => <Cartao key={r.id} empresa={empresa} r={r} aoMudou={refs.recarregar} />)}</ul>
        : !refs.carregando && !nova && <p className="muted pequeno">Nenhuma referência ainda. Guarde um reels, um carrossel ou um texto que você gostaria de ter feito, e diga o que quer copiar dele.</p>}
    </div>
  )
}
