// Marcos: datas em que algo mudou (ex.: "20/10: começamos a postar com o agente"). Cada marco mostra o Antes × Depois
// com o mesmo número de dias. Para o agente explicar se a mudança funcionou, escolhe-se o marco em "Pedir análise".
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { hojeBR, type DiaSeguidores, type PostIG } from './dados'
import { antesEDepois, criarMarco, tirarMarco, type Marco } from './marcos'
import { TabelaPeriodos } from './TabelaPeriodos'

type Props = { empresa: string; marcos: Marco[]; posts: PostIG[]; seguidores: DiaSeguidores[]; aoMudar: () => void }
const dataBR = (d: string) => d.split('-').reverse().join('/')

function NovoMarco({ empresa, aoSalvar, aoCancelar }: { empresa: string; aoSalvar: () => void; aoCancelar: () => void }) {
  const [m, setM] = useState({ dia: hojeBR(), nome: '', descricao: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    setErro(null); setSalvando(true)
    try { await criarMarco(empresa, m); aoSalvar() } catch (e) { setErro((e as Error).message) }
    setSalvando(false)
  }
  return (
    <div className="mc-novo">
      <label><span className="muted pequeno">A partir de</span><input type="date" value={m.dia} onChange={(e) => setM({ ...m, dia: e.target.value })} /></label>
      <label className="mc-nome"><span className="muted pequeno">Nome do marco</span><input value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} placeholder="Ex.: Começamos a postar com o agente" /></label>
      <label className="mc-desc"><span className="muted pequeno">O que mudou (opcional, ajuda o agente a entender)</span>
        <textarea rows={2} value={m.descricao} onChange={(e) => setM({ ...m, descricao: e.target.value })} placeholder="Ex.: 1 carrossel educativo por dia, reels 3x por semana com gancho de erro" /></label>
      <div className="ia-linha"><button type="button" className="btn btn-ouro" disabled={salvando || !m.nome.trim() || !m.dia} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar marco'}</button>
        <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button></div>
      {erro && <p className="erro-txt pequeno">{erro}</p>}
    </div>
  )
}

function CartaoMarco({ marco, posts, seguidores, aberto, aoAbrir, aoTirar }: { marco: Marco; posts: PostIG[]; seguidores: DiaSeguidores[]; aberto: boolean; aoAbrir: () => void; aoTirar: () => void }) {
  const { dias, periodos } = antesEDepois(marco)
  return (
    <li className={`mc-cartao${aberto ? ' aberto' : ''}`}>
      <button type="button" className="mc-cab" onClick={aoAbrir} aria-expanded={aberto}>
        <span className="mc-data">{dataBR(marco.dia)}</span>
        <span className="mc-titulo"><b>{marco.nome}</b>{marco.descricao && <small className="muted">{marco.descricao}</small>}</span>
        <span className="muted pequeno">{dias ? `${dias} ${dias === 1 ? 'dia' : 'dias'} depois` : `começa em ${dataBR(marco.dia)}`}</span>
        <Icone nome={aberto ? 'seta' : 'seta_dir'} tam={14} />
      </button>
      {aberto && <div className="mc-corpo">
        {periodos.length ? <TabelaPeriodos posts={posts} periodos={periodos} seguidores={seguidores} /> : <p className="muted pequeno">O marco ainda não começou: a comparação aparece a partir do dia dele.</p>}
        {dias > 0 && dias < 14 && <p className="muted pequeno">Com poucos dias a comparação ainda oscila muito; ela fica mais confiável a partir de 2 a 4 semanas.</p>}
        <div className="ia-linha"><button type="button" className="btn btn-mini" onClick={aoTirar}><Icone nome="lixeira" tam={13} /> Tirar marco</button></div>
      </div>}
    </li>
  )
}

export function Marcos({ empresa, marcos, posts, seguidores, aoMudar }: Props) {
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<string | null>(marcos[0]?.id ?? null)
  const tirar = async (id: string) => { await tirarMarco(id); aoMudar() }
  return (
    <section className="mk-painel mc-marcos">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="agenda" tam={22} /></span>
        <div><h3>Marcos</h3><span className="muted pequeno">Datas em que algo mudou. Cada marco compara o depois com o mesmo número de dias antes.</span></div>
        {!novo && <button type="button" className="btn btn-contorno-ouro" onClick={() => setNovo(true)}><Icone nome="mais" tam={15} /> Novo marco</button>}
      </header>
      {novo && <NovoMarco empresa={empresa} aoSalvar={() => { setNovo(false); aoMudar() }} aoCancelar={() => setNovo(false)} />}
      {marcos.length ? <ul className="mc-lista">{marcos.map((m) => (
        <CartaoMarco key={m.id} marco={m} posts={posts} seguidores={seguidores} aberto={aberto === m.id} aoAbrir={() => setAberto(aberto === m.id ? null : m.id)} aoTirar={() => tirar(m.id)} />))}</ul>
        : !novo && <p className="muted pequeno">Nenhum marco ainda. Ex.: marque o dia em que começou a postar com o agente para ver o antes e o depois.</p>}
    </section>
  )
}
