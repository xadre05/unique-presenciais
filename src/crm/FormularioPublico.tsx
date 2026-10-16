// CRM — NÚCLEO: página pública de captura (sem login). A marca da empresa vem de fora (prop marca).
// Guarda a origem do clique (utm_*, fbclid, gclid, página) junto com o lead.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type Pergunta = { id: string; rotulo: string; opcoes?: string[]; obrigatoria?: boolean }
type Form = { nome: string; titulo: string | null; texto: string | null; botao: string; pedir_email: boolean; perguntas: Pergunta[] }

const mascaraTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`
}

export default function FormularioPublico({ slug, marca, aviso }: { slug: string; marca?: ReactNode; aviso?: string }) {
  const [form, setForm] = useState<Form | null | 'nao'>(null)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [email, setEmail] = useState('')
  const [resp, setResp] = useState<Record<string, string>>({})
  const [isca, setIsca] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const embutido = params.get('embed') === '1'

  useEffect(() => {
    supabase.rpc('crm_formulario_publico', { p_slug: slug }).then(({ data }) => setForm((data as Form) ?? 'nao'))
  }, [slug])
  useEffect(() => { if (form && form !== 'nao') document.title = form.titulo || form.nome }, [form])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form || form === 'nao') return
    setErro(null)
    if (tel.replace(/\D/g, '').length < 10) return setErro('Confira o WhatsApp com DDD.')
    const falta = form.perguntas.find((p) => p.obrigatoria && !resp[p.id])
    if (falta) return setErro(`Responda: ${falta.rotulo}`)
    setEnviando(true)
    const dados: Record<string, unknown> = { nome, whatsapp: tel, email: email || null, respostas: resp, site: isca, pagina: document.referrer || window.location.href }
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid']) { const v = params.get(k); if (v) dados[k] = v }
    const { data, error } = await supabase.rpc('crm_capturar_lead', { p_slug: slug, p_dados: dados })
    setEnviando(false)
    if (error) return setErro(error.message)
    const r = data as { obrigado: string; redirecionar: string | null }
    if (r.redirecionar) { (embutido ? window.top ?? window : window).location.href = r.redirecionar; return }
    setFeito(r.obrigado)
  }

  if (form === null) return <div className="captura-pagina"><div className="captura-cartao muted">Carregando…</div></div>
  if (form === 'nao') return <div className="captura-pagina"><div className="captura-cartao"><p>Esta página não está mais disponível.</p></div></div>
  return (
    <div className={`captura-pagina${embutido ? ' embutido' : ''}`}>
      <div className="captura-cartao">
        {!embutido && marca}
        {feito ? (
          <div className="captura-feito"><div className="captura-check">✓</div><p>{feito}</p></div>
        ) : (
          <form onSubmit={enviar}>
            {form.titulo && <h1>{form.titulo}</h1>}
            {form.texto && <p className="captura-texto">{form.texto}</p>}
            <label className="campo"><span className="campo-rotulo">Seu nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required /></label>
            <label className="campo"><span className="campo-rotulo">WhatsApp com DDD</span><input value={tel} onChange={(e) => setTel(mascaraTel(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="(61) 99999-9999" required /></label>
            {form.pedir_email && <label className="campo"><span className="campo-rotulo">E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>}
            {form.perguntas.map((p) => (
              <label key={p.id} className="campo"><span className="campo-rotulo">{p.rotulo}{p.obrigatoria ? '' : ' (opcional)'}</span>
                {p.opcoes?.length
                  ? <select value={resp[p.id] ?? ''} onChange={(e) => setResp({ ...resp, [p.id]: e.target.value })}><option value="">Escolha…</option>{p.opcoes.map((o) => <option key={o}>{o}</option>)}</select>
                  : <input value={resp[p.id] ?? ''} onChange={(e) => setResp({ ...resp, [p.id]: e.target.value })} />}
              </label>
            ))}
            <input className="captura-isca" tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} aria-hidden="true" />
            {erro && <div className="erro">{erro}</div>}
            <button className="btn btn-ouro btn-bloco btn-grande" disabled={enviando}>{enviando ? 'Enviando…' : form.botao}</button>
            <p className="muted pequeno captura-lgpd">{aviso ?? 'Ao enviar, você aceita receber o contato da nossa equipe pelo WhatsApp. Você pode pedir para sair quando quiser.'}</p>
          </form>
        )}
      </div>
    </div>
  )
}
