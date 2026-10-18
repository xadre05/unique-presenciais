// Agente de Arte na peça: o botão "Criar arte" (gera a arte da peça ou da lâmina com a IA de imagem) e o
// "O que mudar nesta arte?". Sem a chave da OpenAI, o botão explica o que falta em vez de ficar apagado.
// O estado (tem chave, está gerando, gerar) vem do contexto montado em PaginaPeca.
import { createContext, useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../../lib/supabase'
import { useConsulta } from '../../../../lib/dados'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import type { Peca, Trabalho } from '../../comum'
import { EMPRESA } from '../useMarketing'

type Gerar = (item: number | null, opcoes?: { ajuste?: string; lembrar?: boolean }) => Promise<string | null>
export type ArteCtx = { temChave: boolean; rodando: boolean; gerar: Gerar }
export const ArteContexto = createContext<ArteCtx>({ temChave: false, rodando: false, gerar: async () => null })

export function useArte(peca: Peca, trabalhos: Trabalho[], antes: () => Promise<unknown>, aoMudar: () => void): ArteCtx {
  const chave = useConsulta<{ provedor: string }[]>(() => supabase.from('agentes_chaves').select('provedor').eq('empresa_id', EMPRESA).eq('provedor', 'openai'))
  const rodando = trabalhos.some((t) => t.tipo === 'arte' && t.pedido.peca_id === peca.id && (t.status === 'na_fila' || t.status === 'trabalhando'))
  const gerar: Gerar = async (item, opcoes = {}) => {
    await antes()
    const { data, error } = await supabase.from('agentes_trabalhos').insert({
      empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'arte', pedido: { peca_id: peca.id, item, ajuste: opcoes.ajuste, lembrar: opcoes.lembrar },
    }).select('id').single()
    if (error) return error.message
    const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
    aoMudar()
    return r.error ? 'O Agente de Arte não conseguiu começar. Tente de novo.' : null
  }
  return { temChave: !!chave.dados?.length, rodando, gerar }
}

export function BotaoCriarArte({ texto, item, classe = 'btn btn-contorno-ouro' }: { texto: string; item: number | null; classe?: string }) {
  const { temChave, rodando, gerar } = useContext(ArteContexto)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const clicar = async () => {
    if (!temChave) return setAberto(!aberto)
    setErro(null)
    setErro(await gerar(item))
  }
  return (
    <>
      <button type="button" className={classe} disabled={rodando} onClick={clicar}><Icone nome="floco" tam={16} /> {rodando ? 'Criando a arte…' : texto}</button>
      {aberto && !temChave && (
        <div className="mk-aviso mk-aviso-info pp-aviso-arte">
          <Icone nome="info" tam={18} />
          <span><b>Falta a chave da OpenAI.</b> O Agente de Arte usa a IA de imagem da OpenAI: cadastre a chave em <Link to="/agentes/central" className="link">Configurações</Link>.
            Enquanto isso, faça a arte onde preferir e use <b>Enviar arte pronta</b>.</span>
        </div>
      )}
      <Erro msg={erro} />
    </>
  )
}

// pedir mudança numa arte já gerada ou enviada ("fundo mais escuro", "troca a roupa por jaleco")
export function AjustarArte({ item }: { item: number | null }) {
  const { temChave, rodando, gerar } = useContext(ArteContexto)
  const [texto, setTexto] = useState('')
  const [lembrar, setLembrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (!temChave) return null
  if (rodando) return <div className="progresso"><div className="indeterminado" /><span>Criando a arte (até 1 minuto)…</span></div>
  const pedir = async () => {
    if (!texto.trim()) return setErro('Escreva o que mudar na arte.')
    setErro(null)
    const m = await gerar(item, { ajuste: texto.trim(), lembrar })
    if (m) return setErro(m)
    setTexto('')
  }
  return (
    <div className="pp-ajustar-arte">
      <label className="pp-rotulo" htmlFor={`ajarte-${item ?? 'p'}`}>O que mudar nesta arte?</label>
      <textarea id={`ajarte-${item ?? 'p'}`} rows={2} value={texto} onChange={(e) => { setTexto(e.target.value); setErro(null) }} placeholder="Ex.: fundo mais escuro, título maior, a pessoa de jaleco"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pedir() } }} />
      <label className="pp-check"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> Sugerir como preferência do agente</label>
      <button type="button" className="btn btn-contorno-ouro" onClick={pedir}><Icone nome="floco" tam={16} /> Ajustar arte</button>
      <Erro msg={erro} />
    </div>
  )
}
