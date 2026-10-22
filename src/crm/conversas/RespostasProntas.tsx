// CRM — NÚCLEO: gaveta de respostas prontas. Busca, favoritas e recentes; mostra a mensagem já com o nome da pessoa e pede
// os campos que faltam ({turma}, {link}...) antes de pôr no rascunho. Nada é enviado daqui: a pessoa revisa e envia.
import { useMemo, useState } from 'react'
import { Icone } from '../../components/Icone'
import { primeiroNome } from '../nucleo'
import type { Resposta } from '../tipos'
import { guardarLista, lerLista } from './util'

type Props = { respostas: Resposta[]; nome: string | null | undefined; atendente: string | null | undefined; aoInserir: (texto: string) => void; aoFechar: () => void; aoGerenciar?: () => void }
type Vista = 'favoritas' | 'todas' | 'recentes'

const AUTOMATICOS = ['nome', 'primeiro_nome', 'atendente']
const campos = (t: string) => [...new Set([...t.matchAll(/\{\{?\s*(\w+)\s*\}?\}/g)].map((m) => m[1].toLowerCase()))]
const rotulo = (c: string) => c.replace(/_/g, ' ').replace(/^./, (l) => l.toUpperCase())

export function RespostasProntas({ respostas, nome, atendente, aoInserir, aoFechar, aoGerenciar }: Props) {
  const [vista, setVista] = useState<Vista>('todas')
  const [busca, setBusca] = useState('')
  const [favs, setFavs] = useState(() => lerLista('crm-respostas-favoritas'))
  const recentes = useMemo(() => lerLista('crm-respostas-recentes'), [])
  const [escolhida, setEscolhida] = useState<Resposta | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})

  const termo = busca.trim().toLowerCase()
  const lista = respostas
    .filter((r) => vista === 'todas' || (vista === 'favoritas' ? favs.includes(r.id) : recentes.includes(r.id)))
    .filter((r) => !termo || `${r.atalho} ${r.texto}`.toLowerCase().includes(termo))
    .sort((a, b) => (vista === 'recentes' ? recentes.indexOf(a.id) - recentes.indexOf(b.id) : a.atalho.localeCompare(b.atalho)))
  const favoritar = (id: string) => { const n = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; setFavs(n); guardarLista('crm-respostas-favoritas', n) }

  const pendentes = escolhida ? campos(escolhida.texto).filter((c) => !AUTOMATICOS.includes(c)) : []
  const faltam = pendentes.filter((c) => !valores[c]?.trim())
  const previa = escolhida ? escolhida.texto.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (m, c: string) => {
    const k = c.toLowerCase()
    if (k === 'nome' || k === 'primeiro_nome') return primeiroNome(nome) || m
    if (k === 'atendente') return primeiroNome(atendente) || m
    return valores[k]?.trim() || m
  }) : ''
  const inserir = () => {
    if (!escolhida) return
    guardarLista('crm-respostas-recentes', [escolhida.id, ...recentes.filter((x) => x !== escolhida.id)].slice(0, 15))
    aoInserir(previa)
  }

  return (
    <div className="rp-fundo" onClick={aoFechar}>
      <aside className="rp-gaveta" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Respostas prontas">
        <header className="rp-topo">
          <div><h2>Respostas prontas</h2><p className="muted pequeno">Escolha, confira a mensagem e ponha no rascunho. Você revisa antes de enviar.</p></div>
          {aoGerenciar && <button className="btn btn-mini" onClick={aoGerenciar}><Icone nome="engrenagem" tam={14} /> Gerenciar</button>}
          <button className="btn-icone" onClick={aoFechar} aria-label="Fechar"><Icone nome="fechar" /></button>
        </header>
        <label className="select-icone"><Icone nome="busca" tam={16} /><input autoFocus placeholder="Buscar por atalho ou texto…" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <div className="cl-chips">
          {(['favoritas', 'todas', 'recentes'] as Vista[]).map((v) => <button key={v} className={vista === v ? 'ativo' : ''} onClick={() => setVista(v)}>{rotulo(v)}</button>)}
        </div>
        <div className="rp-corpo">
          <ul className="rp-lista">
            {lista.length === 0 && <li className="muted pequeno rp-vazio">{vista === 'favoritas' ? 'Marque a estrela das que você mais usa.' : 'Nenhuma resposta encontrada.'}</li>}
            {lista.map((r) => (
              <li key={r.id} className={escolhida?.id === r.id ? 'sel' : ''}>
                <button className="rp-estrela" onClick={() => favoritar(r.id)} aria-label="Favorita">{favs.includes(r.id) ? '★' : '☆'}</button>
                <button className="rp-item" onClick={() => { setEscolhida(r); setValores({}) }}><b>/{r.atalho}</b><span className="muted pequeno">{r.texto.slice(0, 70)}</span></button>
              </li>
            ))}
          </ul>
          <section className="rp-previa">
            {!escolhida ? <p className="muted pequeno">Escolha uma resposta para ver a mensagem.</p> : (<>
              <h3>/{escolhida.atalho}</h3>
              <div className="rp-texto">{previa}</div>
              {pendentes.map((c) => <label key={c} className="campo"><span className="campo-rotulo">{rotulo(c)}</span><input value={valores[c] ?? ''} onChange={(e) => setValores({ ...valores, [c]: e.target.value })} /></label>)}
              {faltam.length > 0 && <p className="nota pequeno">{faltam.length === 1 ? '1 campo pendente' : `${faltam.length} campos pendentes`}.</p>}
              <div className="rp-acoes"><button className="btn" onClick={() => setEscolhida(null)}>Cancelar</button><button className="btn btn-ouro" disabled={faltam.length > 0} onClick={inserir}>Pôr no rascunho</button></div>
            </>)}
          </section>
        </div>
      </aside>
    </div>
  )
}
