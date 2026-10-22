// "Equipe e fluxo" na configuração do Agente de Marketing: o nome da social media, quem grava, quem aprova a pauta e
// a edição, com quantos dias de antecedência o vídeo precisa chegar e o WhatsApp de cada pessoa (para os avisos).
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta, msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { atualizarPerfil } from '../memoria'
import { fluxoDe, type Fluxo } from './fluxo'

type Pessoa = { id: string; nome: string }
const PAPEIS: { k: 'grava' | 'aprova_pauta' | 'aprova_edicao'; nome: string }[] = [
  { k: 'grava', nome: 'Grava os vídeos' }, { k: 'aprova_pauta', nome: 'Aprova a pauta' }, { k: 'aprova_edicao', nome: 'Aprova a edição' },
]

export function QuadroFluxo({ empresaId, perfil, aoSalvar }: { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }) {
  const pessoas = useConsulta<Pessoa[]>(() => supabase.from('perfis').select('id,nome').eq('papel', 'admin').order('nome'))
  const [f, setF] = useState<Fluxo>(() => fluxoDe(perfil))
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const mudar = (c: Partial<Fluxo>) => { setOk(false); setF((x) => ({ ...x, ...c })) }
  const alternar = (k: (typeof PAPEIS)[number]['k'], id: string) => mudar({ [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] })
  const salvar = async () => {
    setErro(null)
    const { error } = await atualizarPerfil(empresaId, 'marketing', (atual) => ({ ...atual, fluxo: { ...f, apelido: f.apelido.trim() || 'Júlia' } }))
    if (error) return setErro(msgErro(error))
    setOk(true); aoSalvar()
  }
  return (
    <section className="mk-painel mk-cfg-quadro qf">
      <header className="mk-cfg-cab"><Icone nome="equipe" tam={22} /><h3>Equipe e fluxo</h3></header>
      <p className="muted pequeno">Quem faz o quê, como numa agência: a social media planeja, alguém aprova, quem grava recebe o que gravar e o prazo, o Editor edita e a edição volta para aprovação.</p>
      <div className="mk-cfg-duas">
        <label>Nome da social media<input value={f.apelido} onChange={(e) => mudar({ apelido: e.target.value })} maxLength={30} /></label>
        <label>O vídeo chega quantos dias antes do post?<input type="number" min={0} max={14} value={f.dias_antes} onChange={(e) => mudar({ dias_antes: Math.max(0, Math.min(14, Number(e.target.value) || 0)) })} /></label>
      </div>
      <div className="qf-tabela">
        <div className="qf-linha qf-cab"><span>Pessoa</span>{PAPEIS.map((p) => <span key={p.k}>{p.nome}</span>)}<span>WhatsApp</span></div>
        {(pessoas.dados ?? []).map((p) => (
          <div key={p.id} className="qf-linha">
            <b>{p.nome}</b>
            {PAPEIS.map((r) => <label key={r.k} className="qf-check"><input type="checkbox" checked={f[r.k].includes(p.id)} onChange={() => alternar(r.k, p.id)} aria-label={`${p.nome}: ${r.nome}`} /><small>{r.nome}</small></label>)}
            <input inputMode="tel" placeholder="(61) 99999-9999" value={f.telefones[p.id] ?? ''} onChange={(e) => mudar({ telefones: { ...f.telefones, [p.id]: e.target.value } })} />
          </div>
        ))}
      </div>
      <p className="muted pequeno">Sem ninguém marcado num papel, todo mundo recebe aquele aviso. O WhatsApp é usado quando o número da social media estiver conectado.</p>
      <Erro msg={erro} />
      <div className="ia-linha">{ok && <span className="ok-txt pequeno">Salvo ✓</span>}<button type="button" className="btn btn-ouro btn-mini" onClick={() => void salvar()}>Salvar equipe e fluxo</button></div>
    </section>
  )
}
