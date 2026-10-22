// Recado da social media no topo da Sala: o que é de cada pessoa hoje (gravar, aprovar, planejar), como uma funcionária
// que passa na mesa. Os mesmos avisos vão para o WhatsApp quando ele estiver ligado.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { useAuth } from '../../auth'
import { Icone } from '../../components/Icone'
import type { Peca } from './comum'
import { Retrato } from './Retrato'
import { EMPRESA } from './marketing/useMarketing'
import { avisos, fluxoDe } from './marketing/fluxo'

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }

export function RecadoSocial({ perfilMarketing }: { perfilMarketing?: Record<string, unknown> }) {
  const { perfil } = useAuth()
  const desde = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').neq('status', 'descartada')
    .or(`status.eq.rascunho,dia.gte.${desde}`).limit(400))
  if (!pecas.dados) return null
  const f = fluxoDe(perfilMarketing)
  const lista = avisos(pecas.dados, f, perfil?.id)
  const nome = (perfil?.nome ?? '').split(' ')[0]
  return (
    <section className="recado">
      <Retrato agente="marketing" estado={lista.some((a) => a.tom === 'alerta') ? 'esperando' : 'parado'} alto={92} />
      <div className="recado-corpo">
        <small>{f.apelido} · Social media</small>
        <b>{saudacao()}{nome ? `, ${nome}` : ''}! {lista.length ? 'Hoje é com você:' : 'Tudo em dia por aqui. Quer postar algo diferente hoje?'}</b>
        {lista.length > 0 && <ul>{lista.map((a, k) => <li key={k} className={a.tom}><Link to={a.link}>{a.tom === 'alerta' && <Icone nome="alerta" tam={14} />} {a.texto} <Icone nome="seta_dir" tam={13} /></Link></li>)}</ul>}
        <div className="ia-linha">
          <Link to="/agentes/marketing?modo=semana" className="btn btn-ouro btn-mini">Planejar a semana com a {f.apelido}</Link>
          <Link to="/agentes/marketing?modo=peca" className="btn btn-contorno btn-mini">Postar algo hoje</Link>
        </div>
      </div>
    </section>
  )
}
