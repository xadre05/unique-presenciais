// Testar conhecimento: pergunta um tema e mostra os trechos que o agente encontraria, com o material de origem.
// Só aparecem materiais aprovados (é exatamente o que o agente usa).
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { buscar, type Achado } from './dados'

export function TestarConhecimento({ empresa }: { empresa: string }) {
  const [consulta, setConsulta] = useState('')
  const [achados, setAchados] = useState<Achado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const procurar = async () => {
    if (!consulta.trim()) return
    setErro(null); setBuscando(true)
    try { setAchados(await buscar(empresa, consulta)) } catch (e) { setErro(e instanceof Error ? e.message : 'Falhou.') }
    setBuscando(false)
  }
  return (
    <section className="bm-cartao">
      <h2>Testar conhecimento</h2>
      <p className="muted pequeno">Pergunte um tema e veja o que a marca ensina sobre ele, e de qual material vem.</p>
      <div className="bib-testar">
        <label className="camp-busca"><Icone nome="busca" tam={16} /><input value={consulta} onChange={(e) => setConsulta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && procurar()} placeholder="O que a marca ensina sobre este tema? (ex.: sorriso gengival, lábios)" aria-label="Tema" /></label>
        <button type="button" className="btn btn-contorno-ouro" disabled={buscando} onClick={procurar}><Icone nome="busca" tam={16} /> {buscando ? 'Consultando…' : 'Consultar fontes'}</button>
      </div>
      {achados ? (achados.length
        ? <ol className="bib-achados">{achados.map((a) => <li key={a.trecho_id}><small>{a.fonte_titulo}</small><p>{a.conteudo.slice(0, 360)}{a.conteudo.length > 360 ? '…' : ''}</p></li>)}</ol>
        : <p className="muted pequeno">Nada sobre isso nos materiais aprovados. O agente vai escrever só com o que está em A marca.</p>)
        : <p className="muted pequeno"><Icone nome="info" tam={14} /> O resultado mostra os materiais e os trechos encontrados.</p>}
      <Erro msg={erro} />
    </section>
  )
}
