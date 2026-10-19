// Criar ou editar uma automação de comentário → direct: nome, onde vale (um post publicado, uma peça do agente ou
// qualquer post recente), palavras-chave, a mensagem privada com o link e, se quiser, respostas públicas no comentário.
// À direita, a prévia de como a mensagem chega no direct.
import { useState } from 'react'
import { Erro, Modal } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { NOME_ALVO, palavrasDe, previaMensagem, salvarAutomacao, type Alvo, type Automacao, type PecaAlvo, type PostAlvo } from './dados'

type Props = { empresa: string; editar: Automacao | null; posts: PostAlvo[]; pecas: PecaAlvo[]; aoFechar: () => void; aoSalvar: () => void }
const LIMITE_MENSAGEM = 900
const dm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const resumo = (t: string | null, n = 70) => (t ?? '').replace(/\s+/g, ' ').slice(0, n)

function EscolherPost({ posts, valor, aoMudar }: { posts: PostAlvo[]; valor: string | null; aoMudar: (id: string) => void }) {
  if (!posts.length) return <p className="muted pequeno">Nenhum post lido ainda. Atualize os posts em Resultados.</p>
  return (
    <ul className="au-posts">{posts.map((p) => (
      <li key={p.externo_id}><button type="button" className={`au-post${valor === p.externo_id ? ' ativo' : ''}`} onClick={() => aoMudar(p.externo_id)} aria-pressed={valor === p.externo_id}>
        {p.miniatura ? <img src={p.miniatura} alt="" loading="lazy" /> : <span className="ig-sem-foto"><Icone nome="video" tam={16} /></span>}
        <span><b>{dm(p.publicado_em)} · {p.tipo}</b><small className="muted">{resumo(p.legenda) || 'sem legenda'}</small></span>
      </button></li>))}
    </ul>
  )
}

export function FormAutomacao({ empresa, editar, posts, pecas, aoFechar, aoSalvar }: Props) {
  const [nome, setNome] = useState(editar?.nome ?? '')
  const [alvo, setAlvo] = useState<Alvo>(editar?.alvo ?? 'post')
  const [media, setMedia] = useState<string | null>(editar?.media_id ?? null)
  const [peca, setPeca] = useState(editar?.peca_id ?? '')
  const [palavras, setPalavras] = useState((editar?.palavras ?? []).join(', '))
  const [qualquer, setQualquer] = useState(editar?.qualquer_comentario ?? false)
  const [mensagem, setMensagem] = useState(editar?.mensagem ?? 'Oi, {nome}! Que bom que você comentou. Aqui está o link que prometemos:')
  const [link, setLink] = useState(editar?.link ?? '')
  const [publicas, setPublicas] = useState((editar?.respostas_publicas ?? []).join('\n'))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const lista = palavrasDe(palavras)

  const salvar = async () => {
    if (!nome.trim()) return setErro('Dê um nome para a automação.')
    if (alvo === 'post' && !media) return setErro('Escolha o post.')
    if (alvo === 'peca' && !peca) return setErro('Escolha a peça.')
    if (!qualquer && !lista.length) return setErro('Diga pelo menos uma palavra-chave (ou marque "qualquer comentário").')
    if (!mensagem.trim()) return setErro('Escreva a mensagem do direct.')
    if (link.trim() && !/^https?:\/\/\S+\.\S+/.test(link.trim())) return setErro('O link precisa começar com https://')
    setErro(null); setSalvando(true)
    try {
      await salvarAutomacao(empresa, {
        nome, alvo, media_id: alvo === 'post' ? media : null, peca_id: alvo === 'peca' ? peca : null, palavras: lista, qualquer_comentario: qualquer,
        respostas_publicas: publicas.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 3), mensagem, link,
      }, editar?.id)
      aoSalvar()
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }

  return (
    <Modal titulo={editar ? 'Editar automação' : 'Nova automação de comentário'} aberto onFechar={aoFechar} largo>
      <div className="au-form">
        <div className="au-campos">
          <label className="au-rotulo">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Carrossel da campanha — palavra BLACK" maxLength={80} /></label>

          <span className="au-rotulo">Onde vale</span>
          <div className="au-alvos" role="radiogroup">{(Object.keys(NOME_ALVO) as Alvo[]).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={alvo === a} className={`au-alvo${alvo === a ? ' ativo' : ''}`} onClick={() => setAlvo(a)}>{NOME_ALVO[a]}</button>))}
          </div>
          {alvo === 'post' && <EscolherPost posts={posts} valor={media} aoMudar={setMedia} />}
          {alvo === 'peca' && <>
            <span className="select-icone"><select value={peca} onChange={(e) => setPeca(e.target.value)} aria-label="Peça"><option value="">Escolha a peça…</option>
              {pecas.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.dia ? ` · ${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)}` : ''}{p.status === 'postada' ? ' · publicada' : ''}</option>)}</select></span>
            <small className="muted">Começa a valer quando a peça for publicada no Instagram.</small></>}
          {alvo === 'todos' && <small className="muted">Vale para os comentários de qualquer post publicado nos últimos 7 dias. Se um post tiver automação própria, a dele tem preferência.</small>}

          <label className="au-rotulo">Palavras-chave<input value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder="Ex.: BLACK, quero" disabled={qualquer} /></label>
          <small className="muted">Separe por vírgula. Não importa maiúscula nem acento, e a palavra precisa vir inteira no comentário.</small>
          <label className="pp-check"><input type="checkbox" checked={qualquer} onChange={(e) => setQualquer(e.target.checked)} /> Responder qualquer comentário (sem palavra-chave)</label>

          <label className="au-rotulo">Mensagem no direct<textarea rows={4} value={mensagem} maxLength={LIMITE_MENSAGEM} onChange={(e) => setMensagem(e.target.value)} /></label>
          <small className="muted">{'{nome}'} vira o @ de quem comentou. {mensagem.length}/{LIMITE_MENSAGEM}</small>
          <label className="au-rotulo">Link<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" /></label>
          <small className="muted">Pode deixar em branco e colocar quando a página estiver no ar. Sem link, a mensagem vai só com o texto.</small>

          <label className="au-rotulo">Resposta pública no comentário <small className="muted">(opcional)</small>
            <textarea rows={3} value={publicas} onChange={(e) => setPublicas(e.target.value)} placeholder={'Te mandei no direct! 💛\nAcabei de te enviar, {nome}!'} /></label>
          <small className="muted">Até 3 frases, uma por linha. Uma é sorteada para cada comentário, para não parecer robô.</small>
        </div>
        <aside className="au-previa">
          <span className="au-rotulo">Como chega no direct</span>
          <div className="au-balao">{previaMensagem(mensagem, link) || '…'}</div>
          {!link.trim() && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> Sem link por enquanto.</p>}
          <ul className="au-regras muted pequeno">
            <li>Uma mensagem por comentário, no máximo 7 dias depois dele.</li>
            <li>Vale só para comentários feitos depois de salvar.</li>
            <li>Até a aprovação da Meta, só quem tem papel no app recebe (bom para testar).</li>
          </ul>
        </aside>
      </div>
      <Erro msg={erro} />
      <div className="au-acoes">
        <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}><Icone nome="check" tam={16} /> {salvando ? 'Salvando…' : editar ? 'Salvar' : 'Salvar e ligar'}</button>
      </div>
    </Modal>
  )
}
