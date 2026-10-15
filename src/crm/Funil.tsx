// CRM — NÚCLEO: funil em colunas (uma por etapa). Arraste o cartão para mudar de etapa.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Erro } from '../components/ui'
import { telefoneLegivel } from './nucleo'
import { PainelContato } from './Conversas'
import { horaCurta, type BaseCRM } from './tipos'

type Cartao = { id: string; nome: string | null; telefone: string | null; etapa_id: string; etapa_em: string | null; responsavel_id: string | null }
const POR_COLUNA = 150

export default function Funil({ empresaId, base, painelExtra }: { empresaId: string; base: BaseCRM; painelExtra?: (contatoId: string) => ReactNode }) {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    const res = await Promise.all(base.etapas.map((e) => supabase.from('crm_contatos').select('id,nome,telefone,etapa_id,etapa_em,responsavel_id')
      .eq('empresa_id', empresaId).eq('etapa_id', e.id).order('etapa_em', { ascending: false, nullsFirst: false }).limit(POR_COLUNA)))
    const err = res.find((r) => r.error)
    if (err?.error) setErro(err.error.message)
    setCartoes(res.flatMap((r) => (r.data as Cartao[]) ?? []))
  }, [base.etapas, empresaId])
  useEffect(() => { if (base.etapas.length) carregar() }, [carregar, base.etapas.length])

  const mover = async (id: string, etapa: string) => {
    setCartoes((xs) => xs.map((c) => (c.id === id ? { ...c, etapa_id: etapa, etapa_em: new Date().toISOString() } : c)))
    const { error } = await supabase.from('crm_contatos').update({ etapa_id: etapa, etapa_em: new Date().toISOString() }).eq('id', id)
    if (error) { setErro(error.message); carregar() }
  }

  const t = busca.trim().toLowerCase()
  return (
    <div className="funil-pagina">
      <div className="funil-topo">
        <label className="select-icone"><input placeholder="Buscar no funil" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <span className="muted pequeno">Quem responde uma mensagem entra sozinho na primeira etapa. Arraste o cartão para mudar de etapa.</span>
      </div>
      <Erro msg={erro} />
      <div className="funil">
        {base.etapas.map((e) => {
          const col = cartoes.filter((c) => c.etapa_id === e.id && (!t || `${c.nome ?? ''} ${c.telefone ?? ''}`.toLowerCase().includes(t)))
          return (
            <section key={e.id} className={`funil-col${sobre === e.id ? ' sobre' : ''}`}
              onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id) }} onDragLeave={() => setSobre(null)}
              onDrop={(ev) => { ev.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, e.id); setArrastando(null) }}>
              <header style={{ borderTopColor: e.cor ?? 'var(--borda)' }}><b>{e.nome}</b><span className="muted">{col.length}{col.length >= POR_COLUNA ? '+' : ''}</span></header>
              <div className="funil-cartoes">
                {col.map((c) => (
                  <div key={c.id} className="funil-cartao" draggable onDragStart={() => setArrastando(c.id)} onDragEnd={() => setArrastando(null)} onClick={() => setAberto(c.id)}>
                    <b>{c.nome || 'Sem nome'}</b>
                    <span className="muted pequeno">{telefoneLegivel(c.telefone)}</span>
                    <span className="muted pequeno">{c.responsavel_id ? base.nomeDe(c.responsavel_id) + ' · ' : ''}{c.etapa_em ? `nesta etapa desde ${horaCurta(c.etapa_em)}` : ''}</span>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      {aberto && (
        <div className="gaveta-fundo" onClick={() => { setAberto(null); carregar() }}>
          <div className="gaveta" onClick={(ev) => ev.stopPropagation()}>
            <PainelContato contatoId={aberto} base={base} aberto onFechar={() => { setAberto(null); carregar() }} extra={painelExtra} />
          </div>
        </div>
      )}
    </div>
  )
}
