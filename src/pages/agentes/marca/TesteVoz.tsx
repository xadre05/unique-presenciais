// "Testar voz da marca": o agente escreve um exemplo curto (post e mensagem de WhatsApp) com a base como está na tela,
// mesmo antes de salvar, e diz o que seguiu e o que faltou. Serve para ajustar a base antes de valer para todos.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import type { Rascunho } from './dados'

type Teste = { legenda: string; whatsapp: string; leitura: string }

export function TesteVoz({ empresa, rascunho }: { empresa: string; rascunho: Rascunho }) {
  const [teste, setTeste] = useState<Teste | null>(null)
  const [testando, setTestando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const testar = async () => {
    setErro(null); setTestando(true)
    const { data, error } = await supabase.functions.invoke('agentes', { body: { empresa, testeVoz: rascunho } })
    setTestando(false)
    const d = data as (Teste & { erro?: string }) | null
    if (error || !d || d.erro) return setErro(d?.erro ?? 'O agente não respondeu. Tente de novo.')
    setTeste(d)
  }
  return (
    <div className="bm-teste">
      <button type="button" className="btn btn-contorno bm-gerar" disabled={testando} onClick={testar}><Icone nome="mensagem" tam={16} /> {testando ? 'Escrevendo o exemplo… (até 30 segundos)' : teste ? 'Testar de novo' : 'Testar voz da marca'}</button>
      <span className="muted pequeno">Usa o que está na tela, mesmo sem salvar. Custa alguns centavos.</span>
      <Erro msg={erro} />
      {teste && (
        <div className="bm-proposta">
          <b><Icone nome="imagem" tam={16} /> Exemplo de post</b><pre>{teste.legenda}</pre>
          <b><Icone nome="whats" tam={16} /> Exemplo de WhatsApp</b><pre>{teste.whatsapp}</pre>
          <p className="muted pequeno"><b>O que o agente entendeu:</b> {teste.leitura}</p>
        </div>
      )}
    </div>
  )
}
