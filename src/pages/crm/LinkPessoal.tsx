// Link pessoal da página de vendas de cada vendedora (uniquehofacademy.com.br/<nome>): é por ele que a venda fica
// registrada no nome dela. Entra nas mensagens pelo {link} e aparece no topo da lista com o botão de copiar.
// O administrador vê, em cada contato, o link da vendedora responsável por ele.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Icone } from '../../components/Icone'

type ComVendedora = { vendedora_id: string | null }

export function useLinksPessoais(isAdmin: boolean, contatos: ComVendedora[]) {
  const [meu, setMeu] = useState<string | null>(null)
  const [porVendedora, setPorVendedora] = useState<Record<string, string | null>>({})
  const ids = useMemo(() => [...new Set(contatos.map((c) => c.vendedora_id).filter((x): x is string => !!x))].sort().join(','), [contatos])
  useEffect(() => { if (!isAdmin) void supabase.rpc('link_pessoal_vendedora').then(({ data }) => setMeu((data as string | null) ?? null)) }, [isAdmin])
  useEffect(() => {
    if (!isAdmin || !ids) return
    void Promise.all(ids.split(',').map(async (id) => [id, ((await supabase.rpc('link_pessoal_vendedora', { p_vendedora: id })).data as string | null) ?? null] as const))
      .then((pares) => setPorVendedora(Object.fromEntries(pares)))
  }, [isAdmin, ids])
  return { meu, de: (vendedora: string | null) => (isAdmin ? (vendedora ? porVendedora[vendedora] ?? null : null) : meu) }
}

export function MeuLink({ link }: { link: string | null }) {
  const [copiado, setCopiado] = useState(false)
  if (!link) return null
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sem permissão: a pessoa copia à mão */ } }
  return (
    <div className="meu-link">
      <Icone nome="links" tam={16} />
      <span><small className="muted">Seu link da página (a venda fica no seu nome)</small><b>{link.replace('https://', '')}</b></span>
      <button type="button" className="btn btn-mini" onClick={() => void copiar()}><Icone nome={copiado ? 'check' : 'copiar'} tam={14} /> {copiado ? 'Copiado' : 'Copiar'}</button>
    </div>
  )
}
