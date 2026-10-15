// Criar uma lista (campanha) a partir do filtro da tela de contatos e dividir entre as vendedoras.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCadastros } from '../../lib/dados'
import { Campo, Erro, InputNumero, Modal } from '../../components/ui'
import { preencherMensagem } from '../../crm/nucleo'
import { descreverFiltro, type Filtro, type Mensagem } from './comum'

const PADRAO: Mensagem[] = [
  { titulo: 'Primeira mensagem', texto: 'Oi {nome}, tudo bem? Aqui é a {atendente}, da Unique HOF Academy.\n\n' },
  { titulo: 'Retomar (sem resposta)', texto: 'Oi {nome}! Passando de novo por aqui, conseguiu ver minha mensagem?' },
]

export function EditorMensagens({ msgs, setMsgs }: { msgs: Mensagem[]; setMsgs: (m: Mensagem[]) => void }) {
  const mudar = (i: number, k: keyof Mensagem, v: string) => setMsgs(msgs.map((m, j) => (j === i ? { ...m, [k]: v } : m)))
  return (
    <div className="editor-msgs">
      {msgs.map((m, i) => (
        <div key={i} className="editor-msg">
          <div className="editor-msg-topo">
            <input value={m.titulo} onChange={(e) => mudar(i, 'titulo', e.target.value)} placeholder="Nome da mensagem" />
            {msgs.length > 1 && <button type="button" className="link pequeno" onClick={() => setMsgs(msgs.filter((_, j) => j !== i))}>remover</button>}
          </div>
          <textarea rows={5} value={m.texto} onChange={(e) => mudar(i, 'texto', e.target.value)} />
          <div className="muted pequeno">Como chega: “{preencherMensagem(m.texto, { nome: 'mariana silva', atendente: 'Natália' }).slice(0, 140)}{m.texto.length > 140 ? '…' : ''}”</div>
        </div>
      ))}
      {msgs.length < 4 && <button type="button" className="btn btn-mini" onClick={() => setMsgs([...msgs, { titulo: `Mensagem ${msgs.length + 1}`, texto: '' }])}>+ outra mensagem</button>}
      <p className="muted pequeno">Use <b>{'{nome}'}</b> para o primeiro nome do contato e <b>{'{atendente}'}</b> para o nome de quem manda. A vendedora pode ajustar o texto no WhatsApp antes de enviar.</p>
    </div>
  )
}

export default function CriarLista({ filtro, disponiveis, onFechar }: { filtro: Filtro; disponiveis: number; onFechar: () => void }) {
  const cad = useCadastros()
  const nav = useNavigate()
  const ativas = cad.vendedoras.filter((v) => v.ativa)
  const [nome, setNome] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [msgs, setMsgs] = useState<Mensagem[]>(PADRAO)
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null)
  const [limitar, setLimitar] = useState(false)
  const [limite, setLimite] = useState(Math.max(10, Math.min(500, disponiveis)))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const sel = escolhidas ?? ativas.map((v) => v.id)
  const qtd = limitar ? Math.min(limite, disponiveis) : disponiveis

  const criar = async () => {
    setErro(null); setSalvando(true)
    const { data, error } = await supabase.rpc('criar_campanha', {
      p_nome: nome, p_objetivo: objetivo || null, p_mensagens: msgs.filter((m) => m.texto.trim()), p_filtro: filtro,
      p_vendedoras: sel, p_limite: limitar ? limite : null,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    nav(`/listas/${(data as { id: string }).id}`)
  }

  return (
    <Modal titulo="Criar lista para as vendedoras" aberto onFechar={onFechar} largo>
      <div className="nota pequeno"><b>Quem entra:</b> {descreverFiltro(filtro)}. Só contatos com WhatsApp válido que aceitam mensagem. <b>{disponiveis.toLocaleString('pt-BR')}</b> disponíveis.</div>
      <div className="form-grade">
        <Campo rotulo="Nome da lista"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Black 2026 — compradores" autoFocus /></Campo>
        <Campo rotulo="Objetivo (aparece para a vendedora)"><input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex.: avisar da Black e levar para o grupo VIP" /></Campo>
      </div>

      <h3>Dividir entre</h3>
      <div className="opcoes-vendedoras">
        {ativas.map((v) => (
          <label key={v.id} className="check">
            <input type="checkbox" checked={sel.includes(v.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...sel, v.id] : sel.filter((x) => x !== v.id))} />
            {v.nome}{!v.perfil_id && <span className="muted pequeno"> (ainda sem login)</span>}
          </label>
        ))}
      </div>
      <p className="muted pequeno">{sel.length ? `Cerca de ${Math.ceil(qtd / sel.length).toLocaleString('pt-BR')} contatos para cada uma, com a mesma mistura de compradores e quase compradores.` : 'Escolha pelo menos uma.'}</p>
      <label className="check"><input type="checkbox" checked={limitar} onChange={(e) => setLimitar(e.target.checked)} /> Colocar só uma parte agora (compradores primeiro, depois quase compraram)</label>
      {limitar && <div style={{ maxWidth: 220 }}><InputNumero valor={limite} onChange={setLimite} min={10} max={Math.max(10, disponiveis)} sufixo="contatos" /></div>}

      <h3>Mensagens prontas</h3>
      <EditorMensagens msgs={msgs} setMsgs={setMsgs} />

      <Erro msg={erro} />
      <div className="modal-acoes">
        <button className="btn" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-ouro" onClick={criar} disabled={salvando || !nome.trim() || !sel.length || !qtd}>{salvando ? 'Criando…' : `Criar lista com ${qtd.toLocaleString('pt-BR')} contatos`}</button>
      </div>
    </Modal>
  )
}
