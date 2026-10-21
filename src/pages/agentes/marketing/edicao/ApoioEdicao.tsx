// Passo "Imagens, clipes e música" da aba Vídeo: a equipe sobe fotos, prints e clipes que o agente usa por cima da
// fala (tela cheia ou dividida), escreve o que é cada um e escolhe uma música de fundo. Os arquivos ficam no
// computador; na peça fica só a lista. Ao reabrir, basta escolher os mesmos arquivos de novo.
import { useEffect, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { MusicaFundo } from './dados'
import type { MidiaApoio } from './midias'

export const chaveArquivo = (nome: string, tamanho: number) => `${nome}|${tamanho}`

function Miniatura({ arquivo }: { arquivo?: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!arquivo) { setUrl(null); return }
    const u = URL.createObjectURL(arquivo); setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [arquivo])
  if (!url || !arquivo) return <div className="ev-mini">Escolha o arquivo de novo</div>
  return <div className="ev-mini">{arquivo.type.startsWith('video/') ? <video src={url} muted playsInline /> : <img src={url} alt="" />}</div>
}

type Props = {
  midias: MidiaApoio[]; arquivos: Map<string, File>; musica?: MusicaFundo; arquivoMusica?: File
  aoAdicionar: (f: File[]) => void; aoRemover: (n: number) => void; aoDescrever: (n: number, texto: string) => void
  aoMusica: (f: File | null) => void; aoVolume: (v: number) => void
}

export function ApoioEdicao({ midias, arquivos, musica, arquivoMusica, aoAdicionar, aoRemover, aoDescrever, aoMusica, aoVolume }: Props) {
  // o texto do que é cada mídia só é guardado quando a pessoa sai do campo
  const [rascunhos, setRascunhos] = useState<Record<number, string>>({})
  return (
    <section className="ev-passo">
      <h4><span>2</span> Imagens, clipes e música (opcional)</h4>
      <p className="muted pequeno">Fotos do presencial, prints da plataforma, a página da oferta, clipes de bastidor: o agente coloca por cima da fala nos momentos certos, em tela cheia ou dividida. Escreva em poucas palavras o que é cada um.</p>
      <label className="btn btn-contorno-ouro ev-arquivo"><Icone nome="importar" tam={16} /> Adicionar imagens ou clipes
        <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { aoAdicionar([...(e.target.files ?? [])]); e.target.value = '' }} /></label>
      {midias.length > 0 && (
        <div className="ev-midias">
          {midias.map((m, n) => {
            const arquivo = arquivos.get(chaveArquivo(m.nome, m.tamanho))
            return (
              <div key={chaveArquivo(m.nome, m.tamanho)} className="ev-midia">
                <Miniatura arquivo={arquivo} />
                <span className="ev-nome" title={m.nome}>{n + 1}. {m.nome}</span>
                {!arquivo && <span className="ev-falta">Escolha este arquivo de novo para usar</span>}
                <input type="text" placeholder="O que é (ex.: alunas no presencial)" value={rascunhos[n] ?? m.descricao ?? ''}
                  onChange={(e) => setRascunhos((r) => ({ ...r, [n]: e.target.value }))}
                  onBlur={(e) => { if (e.target.value !== (m.descricao ?? '')) aoDescrever(n, e.target.value) }} />
                <button type="button" className="btn btn-mini" onClick={() => aoRemover(n)}>Tirar</button>
              </div>
            )
          })}
        </div>
      )}
      <div className="ev-musica">
        <label className="btn btn-mini ev-arquivo"><Icone nome="importar" tam={14} /> {musica ? 'Trocar música' : 'Música de fundo'}
          <input type="file" accept="audio/*" hidden onChange={(e) => { aoMusica(e.target.files?.[0] ?? null); e.target.value = '' }} /></label>
        {musica && <>
          <span className="pequeno">{musica.nome}{!arquivoMusica && ' (escolha de novo para usar)'}</span>
          <label className="pequeno">Volume <input type="range" min={0.03} max={0.4} step={0.01} value={musica.volume} onChange={(e) => aoVolume(Number(e.target.value))} /></label>
          <button type="button" className="btn btn-mini" onClick={() => aoMusica(null)}>Sem música</button>
        </>}
      </div>
      <p className="muted pequeno">Use música com licença para redes sociais (ex.: a biblioteca de áudio do Instagram ou do YouTube).</p>
    </section>
  )
}
