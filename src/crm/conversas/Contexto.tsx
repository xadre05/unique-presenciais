// CRM — NÚCLEO: coluna "Contexto" da conversa (e ficha do contato no Funil): quem é, etapa no funil, próxima ação,
// anotações, histórico e a IA desta conversa. O que é só da empresa (ex.: compras) entra pela prop extra.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { Badge, Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { telefoneLegivel } from '../nucleo'
import { horaCurta, type BaseCRM, type Conversa } from '../tipos'
import ProximasAcoes from '../Acoes'
import { Avatar, interesseDe } from '../Pecas'

type Ficha = { id: string; nome: string | null; telefone: string | null; emails: string[]; tags: string[]; cidade: string | null; uf: string | null; etapa_id: string | null; observacoes: string | null; nao_contatar: boolean; origem: string | null; primeira_origem: Record<string, string> | null; responsavel_id: string | null }
type Props = { contatoId: string; base: BaseCRM; aberto: boolean; onFechar: () => void; extra?: (contatoId: string) => ReactNode; conv?: Conversa; aoMudarConversa?: () => void }

function Secao({ titulo, icone, children, inicial = true }: { titulo: string; icone: string; children: ReactNode; inicial?: boolean }) {
  const [aberta, setAberta] = useState(inicial)
  return (
    <section className={`cx-secao${aberta ? ' aberta' : ''}`}>
      <button className="cx-secao-topo" onClick={() => setAberta(!aberta)}><Icone nome={icone} tam={17} /><b>{titulo}</b><Icone nome={aberta ? 'cima' : 'baixo'} tam={15} /></button>
      {aberta && <div className="cx-secao-corpo">{children}</div>}
    </section>
  )
}

export function PainelContato({ contatoId, base, aberto, onFechar, extra, conv, aoMudarConversa }: Props) {
  const [c, setC] = useState<Ficha | null>(null)
  const [obs, setObs] = useState('')
  const [nome, setNome] = useState('')
  const [historico, setHistorico] = useState<{ conversas: number; ultima: string | null } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('crm_contatos').select('id,nome,telefone,emails,tags,cidade,uf,etapa_id,observacoes,nao_contatar,origem,primeira_origem,responsavel_id').eq('id', contatoId).single()
      .then(({ data }) => { setC(data as Ficha); setObs((data as Ficha)?.observacoes ?? ''); setNome((data as Ficha)?.nome ?? '') })
    supabase.from('crm_conversas').select('ultima_em').eq('contato_id', contatoId).order('ultima_em', { ascending: false, nullsFirst: false })
      .then(({ data }) => setHistorico({ conversas: data?.length ?? 0, ultima: (data?.[0]?.ultima_em as string) ?? null }))
  }, [contatoId])
  const alterar = async (campos: Partial<Ficha> & { etapa_em?: string }) => {
    const { error } = await supabase.from('crm_contatos').update(campos).eq('id', contatoId)
    if (error) return setErro(error.message)
    setC((x) => (x ? { ...x, ...campos } : x))
  }
  const etapasOrdem = useMemo(() => [...base.etapas].sort((a, b) => a.ordem - b.ordem), [base.etapas])
  if (!c) return <aside className={`caixa-contato${aberto ? ' aberto' : ''}`} />
  const etapa = base.etapas.find((e) => e.id === c.etapa_id)
  const interesse = interesseDe(c.tags, c.origem)
  const tags = c.tags.filter((t) => !t.startsWith('interesse:'))
  const veioDe = c.primeira_origem?.formulario_nome ?? c.origem
  return (
    <aside className={`caixa-contato${aberto ? ' aberto' : ''}`}>
      <div className="cx-titulo"><span>Contexto</span><button className="btn-icone so-celular" onClick={onFechar} aria-label="Fechar">×</button></div>
      <Secao titulo="Contato" icone="usuario">
        <div className="cc-cabeca">
          <Avatar nome={c.nome || c.telefone} grande />
          <div className="cc-cabeca-txt">
            <input className="cc-nome" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => nome !== (c.nome ?? '') && alterar({ nome })} placeholder="Nome" />
            <span className="muted pequeno">{telefoneLegivel(c.telefone)}{c.cidade ? ` · ${c.cidade}${c.uf ? '/' + c.uf : ''}` : ''}</span>
            {c.emails.length > 0 && <span className="muted pequeno cc-email">{c.emails.join(', ')}</span>}
          </div>
        </div>
        <dl className="cx-dados">
          {veioDe && <><dt>Origem</dt><dd>{veioDe}{c.primeira_origem?.utm_campaign ? <span className="muted pequeno"> · {c.primeira_origem.utm_campaign}</span> : null}</dd></>}
          {interesse && <><dt>Interesse</dt><dd>{interesse}</dd></>}
          <dt>Responsável</dt><dd>{c.responsavel_id ? base.nomeDe(c.responsavel_id) : 'Sem responsável'}</dd>
        </dl>
        {tags.length > 0 && <div className="tags">{tags.slice(0, 12).map((t) => <Badge key={t}>{t}</Badge>)}</div>}
        {c.nao_contatar && <div className="erro-txt pequeno">Pediu para não receber mensagens.</div>}
      </Secao>
      <Secao titulo="Funil" icone="comissoes">
        <span className="muted pequeno">Etapa atual</span>
        <select className="cc-etapa" style={{ borderColor: etapa?.cor ?? undefined }} value={c.etapa_id ?? ''} onChange={(e) => alterar({ etapa_id: e.target.value || null, etapa_em: new Date().toISOString() })}>
          <option value="">Fora do funil</option>{etapasOrdem.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </Secao>
      <Secao titulo="Próxima ação" icone="agenda"><ProximasAcoes contatoId={contatoId} base={base} /></Secao>
      <Secao titulo="Anotações" icone="documento" inicial={!!c.observacoes}>
        <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => obs !== (c.observacoes ?? '') && alterar({ observacoes: obs || null })} placeholder="O que é importante saber dessa pessoa" />
      </Secao>
      {historico && <Secao titulo="Histórico" icone="historico">
        <p className="pequeno">{historico.conversas === 1 ? '1 conversa' : `${historico.conversas} conversas`}{historico.ultima ? <span className="muted"> · último contato {horaCurta(historico.ultima)}</span> : null}</p>
      </Secao>}
      {conv && <IaDaConversa conv={conv} base={base} aoMudar={aoMudarConversa} />}
      <Erro msg={erro} />
      {extra?.(contatoId)}
    </aside>
  )
}

// a IA só responde onde o número tem uma IA ligada; aqui dá para pausar ou retomar nesta conversa
function IaDaConversa({ conv, base, aoMudar }: { conv: Conversa; base: BaseCRM; aoMudar?: () => void }) {
  const canal = base.canais.find((k) => k.id === conv.canal_id)
  const temIA = !!canal?.config?.ia_funcao
  const [erro, setErro] = useState<string | null>(null)
  const mudar = async (comIA: boolean) => {
    const { error } = await supabase.from('crm_conversas').update({ com_ia: comIA, ...(comIA ? { atendente_id: null } : {}) }).eq('id', conv.id)
    if (error) setErro(error.message); else aoMudar?.()
  }
  return (
    <Secao titulo="IA nesta conversa" icone="floco">
      {!temIA ? <p className="muted pequeno">O número {canal?.nome ?? ''} não tem IA ligada: quem responde é a equipe.</p> : (
        <div className="cx-ia">
          <div><b>{conv.com_ia ? 'Respondendo' : 'Pausada nesta conversa'}</b><span className="muted pequeno">{conv.com_ia ? 'A IA responde sozinha as mensagens que chegarem.' : 'A IA não está respondendo nesta conversa.'}</span></div>
          <button className={`btn btn-mini${conv.com_ia ? '' : ' btn-contorno-ouro'}`} onClick={() => mudar(!conv.com_ia)}>{conv.com_ia ? 'Pausar IA' : 'Retomar IA'}</button>
        </div>
      )}
      <Erro msg={erro} />
    </Secao>
  )
}
