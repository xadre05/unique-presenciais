// Base da marca → Referências de criação: o que a equipe guarda de TERCEIROS para o agente aprender formatos
// (concorrentes, outros nichos, quem admiramos, materiais comprados). Separado da Biblioteca da marca, que é o
// conhecimento da própria empresa. As fichas entram na reunião de pauta e na escrita das peças do mesmo formato.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { Miniatura } from '../marketing/peca/arquivos'
import { REDES, type Rede } from '../marketing/redes'
import { CATEGORIAS, mudarReferencia, nomeCategoria, nomeFormato, pedirFicha, tituloReferencia, type Categoria, type Referencia } from './dados'
import { FichaReferencia } from './FichaReferencia'
import { retomarCanal } from './canal'
import { estudarCriativo } from './campeoes'
import { BotaoAjuda } from '../ajuda/BotaoAjuda'

const STATUS: Record<Referencia['status'], string> = { nova: 'Ainda não estudada', analisando: 'O agente está estudando…', pronta: 'Aprendido', erro: 'Não deu certo' }

function Cartao({ empresa, r, aoMudou }: { empresa: string; r: Referencia; aoMudou: () => void }) {
  const [aberta, setAberta] = useState(false)
  const [tirar, setTirar] = useState(false)
  const [estudando, setEstudando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const estudar = async () => {
    setErro(null); setEstudando(true)
    try { await (r.tipo === 'canal' ? retomarCanal(empresa, r) : r.categoria === 'nosso' ? estudarCriativo(empresa, r.id) : pedirFicha(empresa, r.id)); setAberta(true) } catch (e) { setErro((e as Error).message) }
    setEstudando(false); aoMudou()
  }
  const confirmarTirar = async () => { try { await mudarReferencia(r.id, { ativo: false }); aoMudou() } catch (e) { setErro((e as Error).message) } }
  const capa = r.arquivos[0]
  return (
    <li className="ref-cartao">
      <div className="ref-capa">{capa ? <Miniatura caminho={capa.caminho} nome={capa.nome} /> : <span className="ref-sem-capa"><Icone nome="texto" tam={20} /></span>}</div>
      <div className="ref-corpo">
        <div className="ref-titulo"><b>{tituloReferencia(r)}</b>
          <span className="badge">{r.tipo === 'canal' ? 'Canal' : nomeCategoria(r.categoria)}</span>
          <span className={`badge ${r.status === 'pronta' ? 'badge-ok' : r.status === 'erro' ? 'badge-erro' : 'badge-info'}`}>{estudando ? STATUS.analisando : STATUS[r.status]}</span></div>
        <small className="muted">{[r.canal && REDES[r.canal as Rede]?.nome, nomeFormato(r.formato), r.nome && r.autor, r.tipo === 'canal' && `${r.videos.filter((v) => v.ficha).length} de ${r.videos.length} vídeos estudados`].filter(Boolean).join(' · ')}</small>
        {r.ficha?.resumo && <p>{r.ficha.resumo}</p>}
        {r.resultado?.vendas != null && <small className="muted">Vendeu: {r.resultado.vendas} compradores{r.resultado.receita ? `, R$ ${Math.round(r.resultado.receita).toLocaleString('pt-BR')} líquidos` : ''}</small>}
        {r.por_que && <small className="muted">{r.categoria === 'nosso' ? 'Por que vendeu' : 'Copiar daqui'}: {r.por_que}</small>}
        {r.status === 'erro' && r.erro && <small className="ref-erro">{r.erro}</small>}
        {aberta && r.ficha && <FichaReferencia ficha={r.ficha} />}
        <div className="ia-linha">
          {r.ficha && <button type="button" className="btn btn-mini" onClick={() => setAberta(!aberta)}>{aberta ? 'Fechar' : 'Ver o que ele aprendeu'}</button>}
          {(r.status === 'erro' || r.status === 'nova' || (r.tipo === 'canal' && r.status === 'analisando' && !estudando)) && <button type="button" className="btn btn-mini" disabled={estudando} onClick={estudar}><Icone nome="atualizar" tam={13} /> Estudar de novo</button>}
          {r.link && <a className="btn btn-mini" href={r.link} target="_blank" rel="noreferrer"><Icone nome="globo" tam={13} /> Abrir</a>}
          {r.tipo !== 'canal' && r.arquivos.length > 1 && <span className="muted pequeno">{r.arquivos.length} imagens</span>}
          {tirar ? <><span className="pequeno">Tirar esta referência?</span><button type="button" className="btn btn-mini" onClick={confirmarTirar}>Sim, tirar</button><button type="button" className="btn btn-mini" onClick={() => setTirar(false)}>Não</button></>
            : <button type="button" className="btn btn-mini" onClick={() => setTirar(true)}><Icone nome="lixeira" tam={13} /> Tirar</button>}
        </div>
        <Erro msg={erro} />
      </div>
    </li>
  )
}

type Props = { empresa: string; lista: Referencia[]; carregando: boolean; erro: string | null; aoMudou: () => void; aoNova: () => void; aoCanal: () => void }

export function ReferenciasMarca({ empresa, lista, carregando, erro, aoMudou, aoNova, aoCanal }: Props) {
  const [filtro, setFiltro] = useState<Categoria | 'todas'>('todas')
  const visiveis = filtro === 'todas' ? lista : lista.filter((r) => r.categoria === filtro)
  const conta = (c: Categoria) => lista.filter((r) => r.categoria === c).length
  return (
    <section className="bm-cartao ref">
      <div className="camp-cab">
        <div><h2>Referências de criação</h2><p className="muted pequeno">Posts e reels de outras pessoas que servem de modelo de gancho, estrutura, ritmo e visual. Só esta empresa vê.</p></div>
        <span className="ia-linha">
          <button type="button" className="btn btn-contorno-ouro" onClick={aoCanal}><Icone nome="video" tam={15} /> Estudar um canal</button>
          <button type="button" className="btn btn-contorno-ouro" onClick={aoNova}><Icone nome="mais" tam={15} /> Nova referência</button>
          <BotaoAjuda id="estudar-canal" />
        </span>
      </div>
      <div className="ia-linha">
        <button type="button" className={`mk-chip${filtro === 'todas' ? ' ativo' : ''}`} onClick={() => setFiltro('todas')}>Todas ({lista.length})</button>
        {CATEGORIAS.filter((c) => c.id !== 'outro' || conta(c.id)).map((c) => <button key={c.id} type="button" className={`mk-chip${filtro === c.id ? ' ativo' : ''}`} onClick={() => setFiltro(c.id)}>{c.nome}{conta(c.id) ? ` (${conta(c.id)})` : ''}</button>)}
      </div>
      <Erro msg={erro} />
      {visiveis.length ? <ul className="ref-lista">{visiveis.map((r) => <Cartao key={r.id} empresa={empresa} r={r} aoMudou={aoMudou} />)}</ul>
        : !carregando && <div className="ref-vazio"><span className="ref-soltar-ico"><Icone nome="ideia" tam={20} /></span><span><b>Nenhuma referência {filtro === 'todas' ? 'cadastrada' : 'nesta origem'}.</b><br /><span className="muted pequeno">Guarde um reels, um carrossel ou um texto que você gostaria de ter feito, e diga o que quer copiar dele.</span></span></div>}
      <p className="nota-neutra pequeno"><Icone nome="info" tam={14} /> Referências orientam a forma. O que a marca ensina vem da biblioteca aprovada.</p>
    </section>
  )
}
