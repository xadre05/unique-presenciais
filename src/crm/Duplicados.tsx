// CRM — NÚCLEO: contatos que parecem a mesma pessoa (mesmo celular ou mesmo e-mail). O administrador escolhe qual fica;
// conversas, mensagens, tarefas e o resto passam para ele, e o outro fica guardado como "juntado" (não é apagado).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Erro, Vazio } from '../components/ui'
import { telefoneLegivel } from './nucleo'
import { guardarLista, lerLista } from './conversas/util'

type Par = { a: string; a_nome: string | null; a_telefone: string | null; b: string; b_nome: string | null; b_telefone: string | null; motivo: string }
const CHAVE_IGNORADOS = 'crm-duplicados-ignorados'

export default function Duplicados({ empresaId }: { empresaId: string }) {
  const [pares, setPares] = useState<Par[] | null>(null)
  const [ignorados, setIgnorados] = useState(() => lerLista(CHAVE_IGNORADOS))
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('crm_duplicados', { p_empresa: empresaId, p_max: 200 })
    if (error) setErro(error.message); else setPares((data as Par[]) ?? [])
  }, [empresaId])
  useEffect(() => { carregar() }, [carregar])
  const juntar = async (manter: string, juntar: string) => {
    setOcupado(juntar); setErro(null)
    const { error } = await supabase.rpc('crm_mesclar_contatos', { p_manter: manter, p_juntar: juntar })
    if (error) setErro(error.message); else setPares((ps) => (ps ?? []).filter((p) => p.a !== juntar && p.b !== juntar))
    setOcupado(null)
  }
  const ignorar = (p: Par) => { const n = [...ignorados, `${p.a}|${p.b}`]; setIgnorados(n); guardarLista(CHAVE_IGNORADOS, n) }
  const lista = (pares ?? []).filter((p) => !ignorados.includes(`${p.a}|${p.b}`))
  const lado = (nome: string | null, tel: string | null, manter: string, juntarId: string) => (
    <div className="dup-lado"><span><b>{nome || 'Sem nome'}</b><span className="muted pequeno"> {telefoneLegivel(tel)}</span></span>
      <button className="btn btn-mini" disabled={!!ocupado} onClick={() => juntar(manter, juntarId)}>Ficar com este</button></div>
  )
  return (
    <section>
      <p className="muted">Pessoas que aparecem duas vezes (mesmo celular ou mesmo e-mail). Escolha qual cadastro fica: as conversas, tarefas e etiquetas do outro passam para ele.</p>
      <Erro msg={erro} />
      {pares === null ? <p className="muted">Procurando…</p> : !lista.length ? <Vazio>Nenhum contato duplicado.</Vazio> : (
        <ul className="dup-lista">
          {lista.map((p) => (
            <li key={`${p.a}|${p.b}`}>
              <div className="dup-par">{lado(p.a_nome, p.a_telefone, p.a, p.b)}{lado(p.b_nome, p.b_telefone, p.b, p.a)}</div>
              <div className="dup-acoes"><span className="ci-chip">{p.motivo}</span><button className="link pequeno" onClick={() => ignorar(p)}>Não são a mesma pessoa</button></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
