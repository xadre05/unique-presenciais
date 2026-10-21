// Cenas reais geradas por IA (b-roll) para cobrir a fala, na etapa "Imagens e música" do Estúdio. O agente lê a fala e
// sugere as cenas; para cada uma, primeiro a IMAGEM (barata) para aprovar e, se quiser, o CLIPE de 5 s animado a partir
// dela. O que for aprovado entra na lista de mídias deste vídeo e o editor usa no momento certo.
import { useEffect, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { guardarEdicao } from '../../marketing/edicao/dados'
import type { Palavra } from '../../marketing/edicao/linhaTempo'
import { gerarNaHiggsfield, ideiasBroll, linkGerado, type Gerado, type IdeiaBroll } from './servicos'

type Estado = { imagem?: Gerado; clipe?: Gerado; ocupado?: string; erro?: string; usada?: boolean }

function Previa({ g }: { g: Gerado }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { void linkGerado(g).then(setUrl) }, [g.caminho]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!url) return <div className="br-previa" />
  return <div className="br-previa">{g.tipo === 'video' ? <video src={url} autoPlay muted loop playsInline /> : <img src={url} alt="" />}</div>
}

export function GerarBroll({ pecaId, palavras, aoMudar }: { pecaId: string; palavras?: Palavra[]; aoMudar: () => void }) {
  const [ideias, setIdeias] = useState<IdeiaBroll[]>([])
  const [estados, setEstados] = useState<Record<number, Estado>>({})
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const muda = (k: number, e: Partial<Estado>) => setEstados((x) => ({ ...x, [k]: { ...x[k], ...e } }))
  const sugerir = async () => {
    if (!palavras?.length) return
    setErro(null); setBuscando(true)
    try { setIdeias((await ideiasBroll(pecaId, palavras)).ideias); setEstados({}) } catch (e) { setErro((e as Error).message) } finally { setBuscando(false) }
  }
  const gerar = async (k: number, tipo: 'imagem' | 'video') => {
    const i = ideias[k], e = estados[k] ?? {}
    muda(k, { ocupado: tipo === 'imagem' ? 'Gerando a imagem…' : 'Animando o clipe (1 a 4 min)…', erro: undefined })
    try {
      const g = await gerarNaHiggsfield(pecaId, tipo === 'imagem' ? { tipo, prompt: i.prompt } : { tipo, prompt: i.movimento || 'slow cinematic push in', imagem: e.imagem!.caminho, duracao: 5 },
        (s) => muda(k, { ocupado: `${tipo === 'imagem' ? 'Gerando a imagem' : 'Animando o clipe'}… ${s} s` }))
      muda(k, { [tipo === 'imagem' ? 'imagem' : 'clipe']: g, ocupado: undefined })
    } catch (x) { muda(k, { erro: (x as Error).message, ocupado: undefined }) }
  }
  const usar = async (k: number, g: Gerado) => {
    const i = ideias[k]
    await guardarEdicao(pecaId, (e) => ({ ...e, midias: [...(e.midias ?? []), { nome: `IA: ${i.descricao.slice(0, 40)}`, tamanho: 0, tipo: g.tipo, descricao: `${i.descricao} (gerada para o momento: palavras ${i.de} a ${i.ate})`, caminho: g.caminho, bucket: g.bucket, gerada: true }] }))
    muda(k, { usada: true }); aoMudar()
  }

  return (
    <section className="ev-passo br">
      <h4><Icone nome="floco" tam={16} /> Cenas reais geradas por IA</h4>
      <p className="muted pequeno">O agente lê a fala e sugere cenas que ilustram o que é dito. Primeiro sai a imagem (cerca de R$ 0,20) para você aprovar; se quiser movimento, ela vira um clipe de 5 s (cerca de R$ 1,20). Usa a Higgsfield (chave em Configurações).</p>
      {!palavras?.length ? <p className="muted pequeno">Disponível depois da primeira edição (o agente precisa da fala transcrita).</p>
        : <button type="button" className="btn btn-contorno-ouro btn-mini" disabled={buscando} onClick={sugerir}>{buscando ? 'Lendo a fala…' : ideias.length ? 'Sugerir outras cenas' : 'Sugerir cenas para este vídeo'}</button>}
      {erro && <p className="erro-txt pequeno">{erro}</p>}
      {ideias.length > 0 && <ul className="br-lista">{ideias.map((i, k) => {
        const e = estados[k] ?? {}
        return (
          <li key={k} className="br-item">
            {e.clipe ? <Previa g={e.clipe} /> : e.imagem ? <Previa g={e.imagem} /> : <div className="br-previa vazia"><Icone nome="imagem" tam={22} /></div>}
            <div className="br-corpo">
              <b className="pequeno">{i.descricao}</b>
              <span className="muted pequeno">Entra nas palavras {i.de} a {i.ate}</span>
              {e.ocupado ? <span className="pequeno">{e.ocupado}</span> : e.usada ? <span className="ok-txt pequeno"><Icone nome="check" tam={13} /> Na lista de mídias deste vídeo</span> : (
                <div className="ia-linha">
                  {!e.imagem && <button type="button" className="btn btn-ouro btn-mini" onClick={() => void gerar(k, 'imagem')}>Gerar imagem</button>}
                  {e.imagem && !e.clipe && <><button type="button" className="btn btn-ouro btn-mini" onClick={() => void usar(k, e.imagem!)}>Usar a imagem</button>
                    <button type="button" className="btn btn-contorno-ouro btn-mini" onClick={() => void gerar(k, 'video')}>Animar em clipe</button>
                    <button type="button" className="link pequeno" onClick={() => void gerar(k, 'imagem')}>Gerar outra</button></>}
                  {e.clipe && <button type="button" className="btn btn-ouro btn-mini" onClick={() => void usar(k, e.clipe!)}>Usar o clipe</button>}
                </div>
              )}
              {e.erro && <span className="erro-txt pequeno">{e.erro}</span>}
            </div>
          </li>
        )
      })}</ul>}
    </section>
  )
}
