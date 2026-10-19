// Criar ou editar uma campanha: nome, objetivo, período, o que vende (produtos da Base da marca, ou nenhum),
// a oferta em uma frase, como chamar a campanha, a mensagem e as regras, e o link dos materiais.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { textoSituacao, type Produto } from '../marca/dados'
import { campanhaLimpa, type CampanhaGuardada } from './dados'

type Props = { inicial: CampanhaGuardada; produtos: Produto[]; nova: boolean; aoSalvar: (c: CampanhaGuardada) => Promise<string | null>; aoCancelar: () => void }

function ProdutosDaCampanha({ produtos, marcados, aoMudar }: { produtos: Produto[]; marcados: string[]; aoMudar: (ids: string[]) => void }) {
  return (
    <fieldset className="camp-produtos"><legend>O que esta campanha vende <small className="muted">(opcional: campanha de seguidores ou de marca não vende produto)</small></legend>
      {produtos.length ? produtos.map((p) => (
        <label key={p.id} className="pp-check"><input type="checkbox" checked={marcados.includes(p.id)}
          onChange={(e) => aoMudar(e.target.checked ? [...marcados, p.id] : marcados.filter((x) => x !== p.id))} />
          {p.nome || 'Produto sem nome'} <small className="muted">· {textoSituacao(p)}</small></label>))
        : <span className="muted pequeno">Nenhum produto cadastrado em A marca → Produtos e condições.</span>}
      <span className="muted pequeno">Preço, o que entrega e até quando está à venda ficam no produto. Aqui fica a comunicação.</span>
    </fieldset>
  )
}

export function FormCampanha({ inicial, produtos, nova, aoSalvar, aoCancelar }: Props) {
  const [c, setC] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const mudar = (x: Partial<CampanhaGuardada>) => setC((v) => ({ ...v, ...x }))
  const salvar = async () => {
    if (!c.nome.trim()) return setErro('Dê um nome para a campanha.')
    if (c.inicio && c.fim && c.fim < c.inicio) return setErro('O fim vem antes do começo.')
    setSalvando(true); setErro(await aoSalvar(campanhaLimpa(c))); setSalvando(false)
  }
  return (
    <div className="camp-detalhe camp-form mk-form">
      <h3 className="camp-titulo">{nova ? 'Nova campanha' : `Editar: ${inicial.nome}`}</h3>
      <label>Nome<input value={c.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Semana da Residência" /></label>
      <label>Objetivo <small className="muted">(em uma frase)</small><input value={c.objetivo ?? ''} onChange={(e) => mudar({ objetivo: e.target.value })} placeholder="Ex.: vender as vagas da Residência para quem já é aluna" /></label>
      <div className="form-tres">
        <label>Começa em<input type="date" value={c.inicio ?? ''} onChange={(e) => mudar({ inicio: e.target.value })} /></label>
        <label>Termina em<input type="date" value={c.fim ?? ''} onChange={(e) => mudar({ fim: e.target.value })} /></label>
        <label>Encerra às <small className="muted">(Brasília)</small><input type="time" value={c.hora_fim ?? '23:59'} disabled={!c.fim} onChange={(e) => mudar({ hora_fim: e.target.value })} /></label>
      </div>
      <ProdutosDaCampanha produtos={produtos} marcados={c.produtos ?? []} aoMudar={(ids) => mudar({ produtos: ids })} />
      <label>Oferta da campanha <small className="muted">(em uma frase, sem preço: o preço vem do produto)</small>
        <input value={c.oferta ?? ''} onChange={(e) => mudar({ oferta: e.target.value })} placeholder="Ex.: 2 anos de plataforma, mentoria semanal ao vivo e bônus presencial" /></label>
      <label>Nome e comunicação <small className="muted">(como chamar a campanha, palavras que sempre usar)</small>
        <input value={c.comunicacao ?? ''} onChange={(e) => mudar({ comunicacao: e.target.value })} placeholder="Ex.: usar o nome completo, Black Friday Limited Edition" /></label>
      <label>Mensagem, fases e regras <small className="muted">(vale enquanto a campanha durar)</small>
        <textarea rows={7} value={c.descricao ?? ''} onChange={(e) => mudar({ descricao: e.target.value })} placeholder="Fases (aquecimento, abertura, fechamento), mensagem principal, chamada, escassez verdadeira, bônus desta semana e o que não dizer." /></label>
      <label>Link dos materiais <small className="muted">(opcional: página de vendas, pasta, apresentação)</small>
        <input type="url" value={c.link ?? ''} onChange={(e) => mudar({ link: e.target.value })} placeholder="https://" /></label>
      <Erro msg={erro} />
      <div className="ia-linha"><button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar campanha'}</button><button type="button" className="btn" onClick={aoCancelar}>Cancelar</button></div>
    </div>
  )
}
