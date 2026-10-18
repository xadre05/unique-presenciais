// Nova peça com IA: uma conversa com o agente para desenvolver UMA ideia antes de criar a peça.
// À esquerda a conversa; à direita a proposta da peça (o agente atualiza a cada resposta e você pode mudar).
// Ao confirmar, o agente escreve e a peça abre na Produção. Ver docs/agentes/REGRAS_AGENTE_MARKETING.md.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Campo, Erro, Modal } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { AnexosPedido, type Anexo } from '../AnexosPedido'
import { DURACOES, REDES, useRedes, ehVideo, nomeFormato, type Formato, type Rede } from './redes'
import { OBJETIVOS, PUBLICOS } from './textos'
import { EMPRESA, criarTrabalho, pedirTrabalho, type Campanha } from './useMarketing'

type Msg = { de: 'equipe' | 'agente'; texto: string; opcoes?: string[]; hora: string }
type Proposta = { rede: Rede | ''; tipo: Formato | ''; titulo: string; abordagem: string; objetivo: string; publico: string; duracao: string }
const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const ABERTURA: Msg = { de: 'agente', texto: 'O que você quer comunicar? Pode ser uma ideia solta, um tema, uma dúvida de aluna ou uma referência.', opcoes: ['Preciso de ideias', 'Tenho uma referência'], hora: '' }
const VAZIA: Proposta = { rede: '', tipo: '', titulo: '', abordagem: '', objetivo: OBJETIVOS[0], publico: PUBLICOS[0], duracao: '' }

type Props = { aberto: boolean; aoFechar: () => void; dataInicial: string; campanhas: Campanha[]; campanhaPadrao: string; aoCriarCampanha: () => void; aoPronto: (pecaId?: string) => void }

export function NovaPecaIA({ aberto, aoFechar, dataInicial, campanhas, campanhaPadrao, aoCriarCampanha, aoPronto }: Props) {
  const redes = useRedes()
  const [msgs, setMsgs] = useState<Msg[]>([ABERTURA])
  const [texto, setTexto] = useState('')
  const [p, setP] = useState<Proposta>(VAZIA)
  const [dia, setDia] = useState(dataInicial)
  const [campanha, setCampanha] = useState(campanhaPadrao)
  const [maisOpcoes, setMaisOpcoes] = useState(false)
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [verAnexos, setVerAnexos] = useState(false)
  const [pensando, setPensando] = useState(false)
  const [enviando, setEnviando] = useState<'ideia' | 'criar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberturaFeita, setAberturaFeita] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    setCampanha(campanhaPadrao)
    if (!aberturaFeita) { setMsgs([{ ...ABERTURA, hora: agora() }]); setP(VAZIA); setDia(dataInicial); setErro(null); setAnexos([]); setAberturaFeita(true) }
  }, [aberto, campanhaPadrao]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, pensando])

  const mudar = (c: Partial<Proposta>) => setP((x) => ({ ...x, ...c }))
  const fechar = () => { setAberturaFeita(false); aoFechar() }

  const falar = async (fala: string) => {
    const t = fala.trim()
    if (!t || pensando) return
    if (t === 'Tenho uma referência') setVerAnexos(true)
    const conversa = [...msgs, { de: 'equipe' as const, texto: t, hora: agora() }]
    setMsgs(conversa); setTexto(''); setErro(null); setPensando(true)
    const r = await supabase.functions.invoke('agentes', { body: { empresa: EMPRESA, conversa: { mensagens: conversa.map(({ de, texto: x }) => ({ de, texto: x })), proposta: p } } })
    setPensando(false)
    const dados = r.data as { resposta?: string; opcoes?: string[]; proposta?: Partial<Proposta>; erro?: string } | null
    if (r.error || !dados || dados.erro) return setErro(dados?.erro ?? 'O agente não respondeu. Tente de novo.')
    setMsgs((m) => [...m, { de: 'agente', texto: dados.resposta ?? '', opcoes: dados.opcoes, hora: agora() }])
    // o agente atualiza a proposta; canal e formato só entram se combinarem entre si
    const n = dados.proposta ?? {}
    setP((x) => {
      const rede = (n.rede && REDES[n.rede as Rede] ? n.rede : x.rede) as Rede | ''
      const tipo = (n.tipo && rede && REDES[rede as Rede].formatos.includes(n.tipo as Formato) ? n.tipo : x.tipo) as Formato | ''
      return { ...x, rede, tipo, titulo: n.titulo || x.titulo, abordagem: n.abordagem || x.abordagem, objetivo: n.objetivo || x.objetivo, publico: n.publico || x.publico, duracao: n.duracao || x.duracao }
    })
  }

  const peca = () => ({
    tipo: p.rede && p.tipo ? p.tipo : 'auto', rede: p.rede || 'instagram', dia: dia || undefined, campanha: campanha || undefined,
    titulo: (p.titulo || p.abordagem || msgs.find((m) => m.de === 'equipe')?.texto || 'Nova peça').slice(0, 90), tema: p.abordagem,
    briefing: { objetivo: p.objetivo, publico: p.publico, duracao: p.tipo && ehVideo(p.tipo) ? p.duracao || undefined : undefined },
  })
  const resumoConversa = () => msgs.filter((m) => m.texto).slice(-8).map((m) => `${m.de === 'equipe' ? 'Equipe' : 'Agente'}: ${m.texto}`).join('\n')
  const temAlgo = !!(p.titulo || p.abordagem || msgs.some((m) => m.de === 'equipe'))

  const salvarIdeia = async () => {
    setEnviando('ideia'); setErro(null)
    const m = await pedirTrabalho('ideia', { pecas: [peca()] })
    setEnviando(null)
    if (m) return setErro(m)
    setAberturaFeita(false); aoPronto()
  }
  // confirma: o agente escreve e, assim que a peça existe, ela abre na Produção
  const confirmar = async () => {
    setEnviando('criar'); setErro(null)
    const c = campanhas.find((x) => x.id === campanha) ?? null
    const { id, erro: e } = await criarTrabalho('escrever', { novas: [peca()], tema: `${p.abordagem}\n\nConversa com a equipe:\n${resumoConversa()}`, objetivo: p.objetivo, publico: p.publico, campanha: c, anexos })
    if (e || !id) { setEnviando(null); return setErro(e ?? 'Não foi possível criar.') }
    let pecaId: string | undefined
    for (let i = 0; i < 12 && !pecaId; i++) {
      await new Promise((ok) => setTimeout(ok, 1200))
      const { data } = await supabase.from('agentes_trabalhos').select('pedido').eq('id', id).maybeSingle()
      pecaId = ((data?.pedido as { peca_ids?: string[] } | undefined)?.peca_ids ?? [])[0]
    }
    setEnviando(null); setAberturaFeita(false); aoPronto(pecaId)
  }

  return (
    <Modal titulo="Nova peça com IA" aberto={aberto} onFechar={fechar} largo>
      <div className="mk-form">
        <p className="muted mk-criar-sub">Desenvolva uma ideia antes de criar a peça.</p>
        <div className="mk-conversa-grade">
          <section className="mk-conversa">
            <div className="mk-msgs">
              {msgs.map((m, i) => (
                <div key={i} className={`mk-msg ${m.de}`}>
                  <span className={`mk-msg-foto${m.de === 'agente' ? ' avatar' : ''}`}>{m.de === 'agente' ? <img src="/agentes/marketing-avatar.webp?v=1" alt="" /> : <Icone nome="usuario" tam={18} />}</span>
                  <div><p>{m.texto}<small>{m.hora}</small></p>
                    {m.de === 'agente' && !!m.opcoes?.length && i === msgs.length - 1 && <div className="mk-msg-opcoes">{m.opcoes.map((o) => <button key={o} type="button" className="mk-chip" onClick={() => falar(o)}>{o}</button>)}</div>}
                  </div>
                </div>
              ))}
              {pensando && <div className="mk-msg agente"><span className="mk-msg-foto avatar"><img src="/agentes/marketing-avatar.webp?v=1" alt="" /></span><div><p className="mk-digitando"><i /><i /><i /></p></div></div>}
              <div ref={fim} />
            </div>
            <div className="mk-msg-entrada">
              <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Conte sua ideia ou peça um ajuste…" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); falar(texto) } }} />
              <button type="button" className="mk-msg-clipe" title="Anexar referência" onClick={() => setVerAnexos(!verAnexos)}><Icone nome="arquivo" tam={18} /></button>
              <button type="button" className="mk-msg-enviar" disabled={!texto.trim() || pensando} onClick={() => falar(texto)} aria-label="Enviar"><Icone nome="enviar" tam={18} /></button>
            </div>
            {verAnexos && <><AnexosPedido anexos={anexos} aoMudar={setAnexos} /><p className="pequeno muted">A referência vai junto quando o agente escrever a peça.</p></>}
            <div className="mk-msg-sugestoes"><span className="pequeno muted"><Icone nome="ideia" tam={14} /> Sugestões para continuar</span>
              <button type="button" className="mk-chip" onClick={() => falar('Preciso de ideias')}>Preciso de ideias</button>
              <button type="button" className="mk-chip" onClick={() => falar('Sugira o melhor canal e formato para isso')}>Sugerir formato</button></div>
          </section>

          <aside className="mk-proposta">
            <div className="mk-proposta-topo"><span className="mk-etiqueta">+ Proposta para confirmar</span><span className="pequeno muted"><Icone nome="info" tam={13} /> Com base na conversa; você pode mudar.</span></div>
            <h4><Icone nome="documento" tam={20} /> Proposta da peça</h4>
            <dl className="mk-detalhes">
              <dt>Canal</dt><dd><select value={p.rede} onChange={(e) => { const r = e.target.value as Rede | ''; mudar({ rede: r, tipo: r ? (REDES[r].formatos.includes(p.tipo as Formato) ? p.tipo : REDES[r].formatos[0]) : '' }) }}>
                <option value="">O agente escolhe</option>{redes.map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}</select></dd>
              <dt>Formato</dt><dd><select value={p.tipo} disabled={!p.rede} onChange={(e) => mudar({ tipo: e.target.value as Formato, duracao: '' })}>
                {!p.rede ? <option value="">O agente escolhe</option> : REDES[p.rede].formatos.map((f) => <option key={f} value={f}>{nomeFormato(f, p.rede as Rede)}</option>)}</select></dd>
              <dt>Título sugerido</dt><dd><input value={p.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="O agente sugere na conversa" /></dd>
              <dt>Abordagem</dt><dd><textarea rows={3} value={p.abordagem} onChange={(e) => mudar({ abordagem: e.target.value })} placeholder="O que a peça diz, o gancho e a chamada" /></dd>
              <dt>Objetivo</dt><dd><select value={OBJETIVOS.includes(p.objetivo) ? p.objetivo : ''} onChange={(e) => mudar({ objetivo: e.target.value })}>{!OBJETIVOS.includes(p.objetivo) && <option value="">{p.objetivo}</option>}{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</select></dd>
              <dt>Público</dt><dd><select value={PUBLICOS.includes(p.publico) ? p.publico : ''} onChange={(e) => mudar({ publico: e.target.value })}>{!PUBLICOS.includes(p.publico) && <option value="">{p.publico}</option>}{PUBLICOS.map((o) => <option key={o}>{o}</option>)}</select></dd>
              {p.tipo && ehVideo(p.tipo) && <><dt>Duração</dt><dd><select value={p.duracao} onChange={(e) => mudar({ duracao: e.target.value })}><option value="">{p.duracao || '—'}</option>{(DURACOES[p.tipo] ?? []).map((d) => <option key={d}>{d}</option>)}</select></dd></>}
            </dl>
            <button type="button" className="mk-secao-cab mk-opcionais" onClick={() => setMaisOpcoes(!maisOpcoes)}><Icone nome="agenda" tam={18} /><b>Data e campanha <span className="muted">(opcionais)</span></b><Icone nome="seta" tam={16} /></button>
            {maisOpcoes && <div className="mk-form">
              <Campo rotulo="Data planejada"><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
              <Campo rotulo="Campanha"><select value={campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha() : setCampanha(e.target.value))}><option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__nova">+ Nova campanha…</option></select></Campo>
            </div>}
          </aside>
        </div>
        <Erro msg={erro} />
        <footer className="mk-criar-rodape">
          <span className="mk-criar-resumo"><Icone nome="info" tam={18} /><span className="pequeno muted">A peça ainda não foi criada. Ao confirmar, o agente escreve e ela abre na Produção.</span></span>
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn btn-contorno-ouro" disabled={!!enviando || !temAlgo} onClick={salvarIdeia}><Icone nome="documento" tam={16} /> {enviando === 'ideia' ? 'Salvando…' : 'Salvar ideia'}</button>
          <button className="btn btn-ouro" disabled={!!enviando || !temAlgo} onClick={confirmar}><Icone nome="floco" tam={16} /> {enviando === 'criar' ? 'Criando…' : 'Confirmar e criar roteiro'}</button>
        </footer>
      </div>
    </Modal>
  )
}
