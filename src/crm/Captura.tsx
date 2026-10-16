// CRM — NÚCLEO: captura de leads. Formulários próprios (página pública /f/<endereço>), links com campanha,
// código para colocar no site e endereço para ManyChat ou outros sistemas mandarem leads.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Campo, Erro, Modal, Vazio } from '../components/ui'
import type { BaseCRM } from './tipos'

type Pergunta = { id: string; rotulo: string; opcoes?: string[]; obrigatoria?: boolean }
type Formulario = {
  id: string; empresa_id: string; nome: string; slug: string; titulo: string | null; texto: string | null; botao: string; pedir_email: boolean
  perguntas: Pergunta[]; interesse: string | null; etiquetas: string[]; obrigado: string; redirecionar: string | null; cadencia_id: string | null; ativo: boolean
}
type Resumo = { por_formulario: { formulario: string; leads: number; novos: number; vendas: number }[]; por_campanha: { campanha: string; fonte: string; leads: number; vendas: number }[] }

const URL_ENTRADA = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-captura`
const linkDe = (slug: string) => `${window.location.origin}/f/${slug}`
const paraSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
async function copiar(t: string) { try { await navigator.clipboard.writeText(t); return true } catch { return false } }

function Copiavel({ texto, rotulo }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="copiavel">
      {rotulo && <span className="campo-rotulo">{rotulo}</span>}
      <div className="copiavel-linha"><div className="link-endereco">{texto}</div>
        <button className="btn btn-mini" onClick={async () => { if (await copiar(texto)) { setOk(true); setTimeout(() => setOk(false), 1500) } }}>{ok ? 'Copiado' : 'Copiar'}</button></div>
    </div>
  )
}

export default function Captura({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [forms, setForms] = useState<Formulario[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [editar, setEditar] = useState<Formulario | 'novo' | null>(null)
  const [usar, setUsar] = useState<Formulario | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    const [f, r] = await Promise.all([
      supabase.from('crm_formularios').select('*').eq('empresa_id', empresaId).order('criado_em', { ascending: false }),
      supabase.rpc('crm_resumo_captura', { p_empresa: empresaId, p_dias: 30 }),
    ])
    if (f.error) setErro(f.error.message); else setForms((f.data as Formulario[]) ?? [])
    if (!r.error) setResumo(r.data as Resumo)
  }, [empresaId])
  useEffect(() => { carregar() }, [carregar])
  const num = (slug: string) => resumo?.por_formulario.find((x) => x.formulario === slug)
  const ativar = async (f: Formulario) => { const { error } = await supabase.from('crm_formularios').update({ ativo: !f.ativo }).eq('id', f.id); if (error) setErro(error.message); else carregar() }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Captura de leads</h1><p className="muted">Páginas de inscrição e entradas de outros sistemas. Todo lead entra com a origem e a campanha, cai no rodízio e vira tarefa de primeiro contato na fila da vendedora.</p></div>
        <div className="acoes"><button className="btn btn-ouro" onClick={() => setEditar('novo')}>+ Novo formulário</button></div>
      </header>
      <Erro msg={erro} />

      {forms.length === 0 ? <Vazio>Nenhum formulário ainda. Crie o primeiro: por exemplo, “Lista de espera Unique Codes” para o link da bio do Instagram.</Vazio> : (
        <div className="cards">
          {forms.map((f) => {
            const n = num(f.slug)
            return (
              <div key={f.id} className="card-lista">
                <div className="card-lista-topo"><h3>{f.nome}</h3>{f.ativo ? <Badge tom="ok">No ar</Badge> : <Badge tom="apagado">Pausado</Badge>}</div>
                {f.interesse && <div className="muted pequeno">Interesse: {f.interesse}</div>}
                <div className="pequeno">Últimos 30 dias: <b>{n?.leads ?? 0}</b> lead(s) · <b>{n?.novos ?? 0}</b> novo(s) na base · <b className="ok-txt">{n?.vendas ?? 0}</b> compraram depois</div>
                <div className="link-endereco">{linkDe(f.slug)}</div>
                <div className="acoes">
                  <button className="btn btn-mini btn-ouro" onClick={() => setUsar(f)}>Usar / divulgar</button>
                  <button className="btn btn-mini" onClick={() => setEditar(f)}>Editar</button>
                  <a className="btn btn-mini" href={`/f/${f.slug}`} target="_blank" rel="noreferrer">Ver página</a>
                  <button className="btn btn-mini" onClick={() => ativar(f)}>{f.ativo ? 'Pausar' : 'Pôr no ar'}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {resumo && resumo.por_campanha.length > 0 && (
        <section className="bloco mt">
          <h2>De onde vieram · últimos 30 dias</h2>
          <table className="tabela compacta">
            <thead><tr><th>Campanha</th><th>Fonte</th><th className="num">Leads</th><th className="num">Compraram</th><th className="num">Conversão</th></tr></thead>
            <tbody>{resumo.por_campanha.map((c) => (
              <tr key={c.campanha + c.fonte}><td>{c.campanha}</td><td>{c.fonte}</td><td className="num">{c.leads}</td><td className="num ok-txt">{c.vendas}</td><td className="num">{c.leads ? `${Math.round((100 * c.vendas) / c.leads)}%` : '—'}</td></tr>
            ))}</tbody>
          </table>
          <p className="muted pequeno">A campanha vem do link (utm_campaign). Use “Usar / divulgar” para montar um link diferente para cada anúncio, post ou e-mail.</p>
        </section>
      )}

      {editar && <EditarFormulario empresaId={empresaId} base={base} form={editar === 'novo' ? null : editar} onFechar={() => setEditar(null)} onFeito={() => { setEditar(null); carregar() }} />}
      {usar && <UsarFormulario form={usar} onFechar={() => setUsar(null)} />}
    </div>
  )
}

function EditarFormulario({ empresaId, base, form, onFechar, onFeito }: { empresaId: string; base: BaseCRM; form: Formulario | null; onFechar: () => void; onFeito: () => void }) {
  const [f, setF] = useState<Omit<Formulario, 'id' | 'empresa_id'>>(form ?? {
    nome: '', slug: '', titulo: '', texto: '', botao: 'Quero saber mais', pedir_email: true, perguntas: [], interesse: '', etiquetas: [],
    obrigado: 'Recebemos seu contato! Em instantes alguém da equipe fala com você pelo WhatsApp.', redirecionar: '', cadencia_id: null, ativo: true,
  })
  const [slugMexido, setSlugMexido] = useState(!!form)
  const [etiquetas, setEtiquetas] = useState((form?.etiquetas ?? []).join(', '))
  const [erro, setErro] = useState<string | null>(null)
  const mudar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const mudarPergunta = (i: number, p: Partial<Pergunta>) => mudar('perguntas', f.perguntas.map((x, j) => (j === i ? { ...x, ...p } : x)))

  const salvar = async () => {
    setErro(null)
    const reg = { ...f, empresa_id: empresaId, slug: paraSlug(f.slug || f.nome), titulo: f.titulo || null, texto: f.texto || null, interesse: f.interesse || null,
      redirecionar: f.redirecionar?.trim() || null, etiquetas: etiquetas.split(',').map((t) => t.trim()).filter(Boolean),
      perguntas: f.perguntas.filter((p) => p.rotulo.trim()).map((p) => ({ ...p, id: p.id || paraSlug(p.rotulo).slice(0, 30) })) }
    if (reg.slug.length < 2) return setErro('Escolha o endereço da página.')
    const r = form ? await supabase.from('crm_formularios').update(reg).eq('id', form.id) : await supabase.from('crm_formularios').insert(reg)
    if (r.error) return setErro(r.error.message.includes('duplicate') ? 'Esse endereço já está em uso. Escolha outro.' : r.error.message)
    onFeito()
  }
  return (
    <Modal titulo={form ? `Editar ${form.nome}` : 'Novo formulário'} aberto onFechar={onFechar} largo>
      <div className="form-grade">
        <Campo rotulo="Nome (interno)" dica="Vira a “origem” do lead. Ex.: Lista de espera Unique Codes"><input value={f.nome} onChange={(e) => { mudar('nome', e.target.value); if (!slugMexido) mudar('slug', paraSlug(e.target.value)) }} /></Campo>
        <Campo rotulo="Endereço da página" dica={`${window.location.origin}/f/${paraSlug(f.slug || f.nome) || '…'}`}><input value={f.slug} onChange={(e) => { setSlugMexido(true); mudar('slug', e.target.value) }} /></Campo>
        <Campo rotulo="Título na página"><input value={f.titulo ?? ''} onChange={(e) => mudar('titulo', e.target.value)} placeholder="Ex.: Lista de espera da próxima turma" /></Campo>
        <Campo rotulo="Texto do botão"><input value={f.botao} onChange={(e) => mudar('botao', e.target.value)} /></Campo>
      </div>
      <Campo rotulo="Texto abaixo do título"><textarea rows={3} value={f.texto ?? ''} onChange={(e) => mudar('texto', e.target.value)} placeholder="Ex.: Deixe seu WhatsApp e a equipe te chama com as datas e condições." /></Campo>
      <label className="check"><input type="checkbox" checked={f.pedir_email} onChange={(e) => mudar('pedir_email', e.target.checked)} /> Pedir e-mail (opcional para a pessoa)</label>

      <h3 className="mt">Perguntas extras</h3>
      <p className="muted pequeno">Ajuda a vendedora a chegar sabendo quem é. Ex.: “Sua profissão” com opções Dentista, Biomédica, Médica, Outra.</p>
      {f.perguntas.map((p, i) => (
        <div key={i} className="pergunta-linha">
          <input value={p.rotulo} onChange={(e) => mudarPergunta(i, { rotulo: e.target.value })} placeholder="Pergunta" />
          <input value={(p.opcoes ?? []).join(', ')} onChange={(e) => mudarPergunta(i, { opcoes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Opções separadas por vírgula (vazio = resposta livre)" />
          <label className="check"><input type="checkbox" checked={!!p.obrigatoria} onChange={(e) => mudarPergunta(i, { obrigatoria: e.target.checked })} /> obrigatória</label>
          <button className="link pequeno" onClick={() => mudar('perguntas', f.perguntas.filter((_, j) => j !== i))}>tirar</button>
        </div>
      ))}
      <button className="btn btn-mini" onClick={() => mudar('perguntas', [...f.perguntas, { id: '', rotulo: '' }])}>+ Pergunta</button>

      <h3 className="mt">Depois que a pessoa envia</h3>
      <div className="form-grade">
        <Campo rotulo="Interesse (produto ou assunto)" dica="Vira etiqueta no contato e aparece na tarefa da vendedora"><input value={f.interesse ?? ''} onChange={(e) => mudar('interesse', e.target.value)} placeholder="Ex.: Unique Codes" /></Campo>
        <Campo rotulo="Etiquetas" dica="Separadas por vírgula"><input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Ex.: black-2026, instagram" /></Campo>
        <Campo rotulo="Follow-up automático"><select value={f.cadencia_id ?? ''} onChange={(e) => mudar('cadencia_id', e.target.value || null)}>
          <option value="">Nenhum (só a tarefa de primeiro contato)</option>{base.cadencias.filter((c) => c.ativa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select></Campo>
        <Campo rotulo="Mandar a pessoa para (opcional)" dica="Ex.: grupo do WhatsApp ou página de obrigado. Vazio = mostra a mensagem abaixo"><input value={f.redirecionar ?? ''} onChange={(e) => mudar('redirecionar', e.target.value)} placeholder="https://…" /></Campo>
      </div>
      <Campo rotulo="Mensagem de obrigado"><textarea rows={2} value={f.obrigado} onChange={(e) => mudar('obrigado', e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar} disabled={!f.nome.trim()}>Salvar</button></div>
    </Modal>
  )
}

const FONTES = [['instagram', 'Instagram (bio, story, post)'], ['facebook', 'Facebook / anúncio Meta'], ['google', 'Google'], ['whatsapp', 'WhatsApp (grupo, status)'], ['email', 'E-mail'], ['site', 'Site'], ['youtube', 'YouTube'], ['outro', 'Outro']] as const

function UsarFormulario({ form, onFechar }: { form: Formulario; onFechar: () => void }) {
  const [fonte, setFonte] = useState('instagram')
  const [meio, setMeio] = useState('')
  const [campanha, setCampanha] = useState('')
  const [conteudo, setConteudo] = useState('')
  const q = new URLSearchParams()
  q.set('utm_source', fonte); if (meio) q.set('utm_medium', paraSlug(meio)); if (campanha) q.set('utm_campaign', paraSlug(campanha)); if (conteudo) q.set('utm_content', paraSlug(conteudo))
  const link = `${linkDe(form.slug)}?${q.toString()}`
  const iframe = `<iframe src="${linkDe(form.slug)}?embed=1&utm_source=site" style="width:100%;max-width:480px;height:620px;border:0" title="${form.titulo || form.nome}"></iframe>`
  const exemplo = JSON.stringify({ nome: '{{first_name}}', whatsapp: '{{phone}}', email: '{{email}}', utm_source: 'manychat', utm_campaign: 'nome-da-campanha' }, null, 2)
  return (
    <Modal titulo={`Divulgar: ${form.nome}`} aberto onFechar={onFechar} largo>
      <h3>1. Link com campanha</h3>
      <p className="muted pequeno">Use um link diferente para cada lugar (bio, cada anúncio, cada e-mail). Assim o sistema mostra de onde veio cada lead e quem comprou depois.</p>
      <div className="form-grade">
        <Campo rotulo="Onde o link vai ficar"><select value={fonte} onChange={(e) => setFonte(e.target.value)}>{FONTES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></Campo>
        <Campo rotulo="Campanha" dica="Ex.: black-2026, lista-espera-codes"><input value={campanha} onChange={(e) => setCampanha(e.target.value)} /></Campo>
        <Campo rotulo="Tipo (opcional)" dica="Ex.: bio, story, anuncio, reels"><input value={meio} onChange={(e) => setMeio(e.target.value)} /></Campo>
        <Campo rotulo="Qual peça (opcional)" dica="Ex.: video-depoimento, carrossel-precos"><input value={conteudo} onChange={(e) => setConteudo(e.target.value)} /></Campo>
      </div>
      <Copiavel texto={link} />

      <h3 className="mt">2. Colocar no site</h3>
      <p className="muted pequeno">Cole este código no site (Elementor, WordPress, página de vendas) onde o formulário deve aparecer.</p>
      <Copiavel texto={iframe} />

      <h3 className="mt">3. ManyChat, Typebot ou outro sistema</h3>
      <p className="muted pequeno">No ManyChat: ação “Requisição externa” (External Request), método POST, cole o endereço abaixo e mande os campos como no exemplo. O lead entra igual ao do formulário.</p>
      <Copiavel texto={`${URL_ENTRADA}?f=${form.slug}`} rotulo="Endereço (POST)" />
      <pre className="link-endereco">{exemplo}</pre>
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Fechar</button></div>
    </Modal>
  )
}
