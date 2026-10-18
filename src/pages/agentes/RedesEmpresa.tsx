// Redes sociais da empresa (Base da marca): quais canais a empresa usa e o perfil em cada um.
// Só os canais ligados aparecem nos filtros, no planejamento e na criação de peças; o agente escreve para eles.
// Para facilitar: o nome de usuário da marca preenche de uma vez as redes ligadas (no formato de cada uma),
// escrever num campo já liga o canal, e links colados são arrumados sozinhos (ex.: https://instagram.com/x → @x).
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { REDES, REDES_PADRAO, TODAS_REDES, nomeFormato, type CadastroRedes, type Rede } from './marketing/redes'
import { LogoRede } from './marketing/LogoRede'

const OUTROS: Rede[] = ['email', 'whatsapp', 'site']
const SOCIAIS = TODAS_REDES.filter((r) => !OUTROS.includes(r))
// como o perfil fica em cada rede, a partir do nome de usuário
const MODELO: Partial<Record<Rede, (u: string) => string>> = {
  instagram: (u) => `@${u}`, tiktok: (u) => `@${u}`, threads: (u) => `@${u}`,
  youtube: (u) => `youtube.com/@${u}`, facebook: (u) => `facebook.com/${u}`, linkedin: (u) => `linkedin.com/company/${u}`, pinterest: (u) => `pinterest.com/${u}`,
}
const COM_ARROBA: Rede[] = ['instagram', 'tiktok', 'threads']

function inicial(perfil: Record<string, unknown>): CadastroRedes {
  const salvo = perfil.redes as CadastroRedes | undefined
  if (salvo) return salvo
  // primeira vez: liga os 3 canais iniciais e aproveita o Instagram que já estava na base
  return Object.fromEntries(REDES_PADRAO.map((r) => [r, { ativa: true, perfil: r === 'instagram' ? String(perfil.instagram ?? '') : '' }]))
}

// tira "https://www." e, nas redes de @, transforma o link colado em @usuario; WhatsApp ganha a máscara
function arrumar(r: Rede, valor: string) {
  let v = valor.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
  if (COM_ARROBA.includes(r) && v.includes('/')) v = `@${v.split('/').pop()!.replace(/^@/, '')}`
  else if (COM_ARROBA.includes(r) && v && !v.startsWith('@')) v = `@${v}`
  if (r === 'whatsapp') {
    const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    if (d.length === 11) v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    else if (d.length === 10) v = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  return v
}

// nome de usuário sugerido: o @ do Instagram, se já houver
const usuarioDe = (cad: CadastroRedes) => (cad.instagram?.perfil ?? '').replace(/^@/, '').trim()

export function RedesEmpresa({ empresaId, perfil, aoSalvar }: { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }) {
  const [cad, setCad] = useState<CadastroRedes>(() => inicial(perfil))
  const [usuario, setUsuario] = useState(() => usuarioDe(inicial(perfil)))
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const mudar = (r: Rede, c: Partial<{ ativa: boolean; perfil: string }>) => { setOk(false); setCad((x) => ({ ...x, [r]: { ativa: x[r]?.ativa ?? false, perfil: x[r]?.perfil ?? '', ...c } })) }
  const ligadas = TODAS_REDES.filter((r) => cad[r]?.ativa).length

  // preenche só os campos vazios das redes ligadas (não apaga o que já foi escrito)
  const preencher = () => {
    const u = usuario.trim().replace(/^@/, '')
    if (!u) return
    setOk(false)
    setCad((x) => Object.fromEntries(TODAS_REDES.map((r) => {
      const atual = x[r]
      const pode = atual?.ativa && !atual.perfil?.trim() && MODELO[r]
      return [r, pode ? { ...atual, perfil: MODELO[r]!(u) } : atual]
    }).filter(([, v]) => v)) as CadastroRedes)
  }

  const salvar = async () => {
    setErro(null); setOk(false)
    if (!ligadas) return setErro('Ligue pelo menos um canal.')
    const limpo = Object.fromEntries(TODAS_REDES.filter((r) => cad[r]).map((r) => [r, { ativa: !!cad[r]?.ativa, perfil: arrumar(r, cad[r]?.perfil ?? '') || undefined }]))
    const { data: atual } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresaId).eq('agente_id', 'marketing').maybeSingle()
    const base = (atual?.perfil ?? {}) as Record<string, unknown>
    const instagram = limpo.instagram?.perfil ?? base.instagram
    const { error } = await supabase.from('agentes_empresa').upsert({ empresa_id: empresaId, agente_id: 'marketing', perfil: { ...base, redes: limpo, instagram }, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,agente_id' })
    if (error) return setErro(msgErro(error))
    setCad(limpo as CadastroRedes); setOk(true); aoSalvar()
  }

  const linha = (r: Rede) => {
    const ativa = !!cad[r]?.ativa
    return (
      <div key={r} className={`mk-rede-linha${ativa ? ' ativa' : ''}`}>
        <button type="button" className="mk-rede-logo" onClick={() => mudar(r, { ativa: !ativa })} aria-label={`${ativa ? 'Desligar' : 'Ligar'} ${REDES[r].nome}`}><LogoRede rede={r} tam={26} /></button>
        <div className="mk-rede-info"><b>{REDES[r].nome}</b><span className="muted pequeno">{REDES[r].formatos.map((f) => nomeFormato(f, r)).join(' · ')}</span></div>
        <input value={cad[r]?.perfil ?? ''} placeholder={REDES[r].exemplo} inputMode={r === 'whatsapp' ? 'tel' : r === 'email' ? 'email' : 'text'}
          onChange={(e) => mudar(r, { perfil: e.target.value, ...(e.target.value.trim() ? { ativa: true } : {}) })}
          onBlur={(e) => e.target.value && mudar(r, { perfil: arrumar(r, e.target.value) })} aria-label={`Perfil no ${REDES[r].nome}`} />
        <label className={`interruptor${ativa ? ' ligado' : ''}`}><input type="checkbox" checked={ativa} onChange={(e) => mudar(r, { ativa: e.target.checked })} />{ativa ? 'Usa' : 'Não usa'}</label>
      </div>
    )
  }

  return (
    <div className="mk-redes-cad">
      <div className="mk-redes-rapido">
        <Icone nome="floco" tam={20} />
        <div><b>Preenchimento rápido</b><span className="muted pequeno">Digite o nome de usuário da marca. Os campos vazios das redes ligadas são preenchidos no formato de cada uma.</span></div>
        <label className="select-icone"><span className="muted">@</span><input value={usuario} onChange={(e) => setUsuario(e.target.value.replace(/^@/, ''))} onKeyDown={(e) => e.key === 'Enter' && preencher()} placeholder="nomedamarca" aria-label="Nome de usuário da marca" /></label>
        <button type="button" className="btn btn-contorno-ouro" disabled={!usuario.trim()} onClick={preencher}>Preencher redes ligadas</button>
      </div>
      <p className="muted pequeno">Dica: escrever num campo já liga o canal. Pode colar o link do perfil, que ele arruma sozinho.</p>
      <span className="mk-redes-grupo">Redes sociais</span>
      {SOCIAIS.map(linha)}
      <span className="mk-redes-grupo">Outros canais</span>
      {OUTROS.map(linha)}
      <p className="muted pequeno">Quer outro canal (ex.: X, Telegram, Spotify)? Peça para incluir: cada canal precisa dos formatos e do jeito de escrever dele.</p>
      <Erro msg={erro} />
      <div className="modal-acoes">{ok && <span className="ok-txt pequeno">Salvo ✓</span>}<span className="muted pequeno">{ligadas} {ligadas === 1 ? 'canal ligado' : 'canais ligados'}</span><button className="btn btn-ouro" onClick={salvar}>Salvar redes sociais</button></div>
    </div>
  )
}
