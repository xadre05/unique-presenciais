// Cortes de vídeo longo (/agentes/editor/cortes): uma aula, live ou podcast vira vários reels. 1) a pessoa escolhe o
// vídeo (fica no computador); 2) o áudio é lido aos pedaços e transcrito; 3) o agente propõe os melhores trechos, com
// o motivo e uma nota; 4) a pessoa assiste, ajusta o começo e o fim, marca os que quer e cria os vídeos, que vão para
// "Em edição" e são editados no Estúdio (o corte já vem com a fala transcrita, sem pagar de novo).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { Voltar } from '../../../../components/Voltar'
import { EMPRESA } from '../../marketing/useMarketing'
import { useLogos } from '../../LogosMarca'
import { doArraste, escolherComAtalho, type Atalho } from '../arquivoPendente'
import { transcreverLongo } from './audioLongo'
import { criarCortes, guardarTranscricao, pedirCortes, transcricaoGuardada, type Corte, type Transcricao } from './dados'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const hhmm = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`)
const NOME_TIPO: Record<string, string> = { ensino: 'Ensino', historia: 'História', polemica: 'Opinião forte', resultado: 'Resultado', erro_comum: 'Erro comum', bastidor: 'Bastidor', oferta: 'Oferta' }
// US$ 0,006 por minuto de transcrição; câmbio aproximado de R$ 5,60
const custoTranscricao = (s: number) => (s / 60) * 0.006 * 5.6

export default function CortesVideoLongo() {
  const ir = useNavigate()
  const entrada = useRef<HTMLInputElement>(null)
  const player = useRef<HTMLVideoElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [atalho, setAtalho] = useState<Atalho | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duracao, setDuracao] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [t, setT] = useState<Transcricao | null>(null)
  const [cortes, setCortes] = useState<(Corte & { marcado: boolean })[]>([])
  const [quantos, setQuantos] = useState(10)
  const [ocupado, setOcupado] = useState<{ texto: string; fracao?: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tocando, setTocando] = useState<number | null>(null)
  const campanhas = ((useLogos(EMPRESA).dados?.perfil?.campanhas ?? []) as { id: string; nome: string; encerrada?: boolean }[]).filter((c) => !c.encerrada)
  const [campanha, setCampanha] = useState('')
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const escolher = async (f: File | null, a: Atalho | null = null) => {
    if (!f) return
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) return setErro('Escolha um arquivo de vídeo.')
    setErro(null); setArquivo(f); setAtalho(a); setUrl(URL.createObjectURL(f)); setTitulo(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    const guardada = await transcricaoGuardada(f)
    setT(guardada); setCortes((guardada?.cortes ?? []).map((c) => ({ ...c, marcado: c.nota >= 7 })))
  }
  const procurar = async () => { const r = await escolherComAtalho(); if (r === null) entrada.current?.click(); else if (r !== 'cancelado') void escolher(r.arquivo, r.atalho) }
  const transcrever = async () => {
    if (!arquivo) return
    setErro(null); setOcupado({ texto: 'Abrindo o vídeo…', fracao: 0 })
    try {
      const r = await transcreverLongo(arquivo, (texto, fracao) => setOcupado({ texto, fracao }))
      if (!r.palavras.length) throw new Error('Não encontrei fala neste vídeo.')
      setT(r); await guardarTranscricao(arquivo, r)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) }
  }
  const encontrar = async () => {
    if (!t || !arquivo) return
    setErro(null); setOcupado({ texto: 'O agente está lendo o vídeo inteiro e escolhendo os trechos…' })
    try {
      const lista = await pedirCortes(titulo, t, quantos)
      setCortes(lista.map((c) => ({ ...c, marcado: c.nota >= 7 })))
      await guardarTranscricao(arquivo, { ...t, cortes: lista })
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) }
  }
  const assistir = (k: number) => {
    const v = player.current, c = cortes[k]
    if (!v || !c) return
    if (tocando === k && !v.paused) { v.pause(); setTocando(null); return }
    v.currentTime = c.de; void v.play(); setTocando(k)
  }
  // para o player no fim do corte que está tocando
  const aoTempo = () => { const v = player.current, c = tocando !== null ? cortes[tocando] : null; if (v && c && v.currentTime >= c.ate) { v.pause(); setTocando(null) } }
  const mudar = (k: number, campos: Partial<Corte & { marcado: boolean }>) => setCortes((l) => l.map((c, i) => (i === k ? { ...c, ...campos } : c)))
  const criar = async () => {
    if (!arquivo || !t) return
    const escolhidos = cortes.filter((c) => c.marcado)
    setErro(null); setOcupado({ texto: `Criando ${escolhidos.length} vídeo(s)…` })
    try { await criarCortes(arquivo, atalho, escolhidos, t, campanha || undefined); ir('/agentes/editor') } catch (e) { setErro((e as Error).message); setOcupado(null) }
  }
  const marcados = cortes.filter((c) => c.marcado).length

  return (
    <div className="pagina cortes">
      <div className="migalha"><Voltar para="/agentes/editor" texto="Agente Editor de Vídeo" /></div>
      <header className="cortes-topo">
        <h1>Cortes de vídeo longo</h1>
        <p className="muted">Uma aula, live ou podcast vira vários reels. O agente acha os melhores trechos; você escolhe e cada um vai para o Estúdio.</p>
      </header>
      <Erro msg={erro} />

      {!arquivo ? (
        <section className="bloco">
          <button type="button" className="ed-soltar" onClick={procurar} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void doArraste(e.dataTransfer).then((r) => escolher(r.arquivo, r.atalho)) }}>
            <span className="ed-soltar-ico"><Icone nome="live" tam={26} /></span>
            <b>Arraste o vídeo longo</b>
            <span className="muted">MP4 ou MOV de qualquer tamanho (1, 2, 3 horas). Ele não sobe para o sistema: só o áudio é transcrito.</span>
            <span className="btn btn-ouro ed-selecionar"><Icone nome="importar" tam={15} /> Selecionar vídeo</span>
          </button>
          <input ref={entrada} type="file" accept="video/*" hidden onChange={(e) => { void escolher(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </section>
      ) : (
        <div className="cortes-grade">
          <section className="bloco cortes-video">
            <video ref={player} src={url ?? undefined} controls playsInline onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration)} onTimeUpdate={aoTempo} />
            <label className="campo"><span>Nome do vídeo</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
            <label className="campo"><span>Campanha dos cortes</span><span className="select-icone"><select value={campanha} onChange={(e) => setCampanha(e.target.value)}>
              <option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span></label>
            <p className="muted pequeno">{arquivo.name} · {(arquivo.size / 1048576).toFixed(0)} MB{duracao ? ` · ${hhmm(duracao)}` : ''}</p>
            <button type="button" className="link pequeno" onClick={() => { setArquivo(null); setT(null); setCortes([]) }} disabled={!!ocupado}>Trocar vídeo</button>
          </section>

          <section className="bloco cortes-passos">
            <ol className="cortes-etapas">
              <li className={t ? 'feita' : 'atual'}>
                <b>1. Transcrever a fala</b>
                {t ? <span className="ok-txt pequeno"><Icone nome="check" tam={13} /> {t.palavras.length.toLocaleString('pt-BR')} palavras · {hhmm(t.duracao)}</span> : (<>
                  <span className="muted pequeno">Custo aproximado: R$ {custoTranscricao(duracao || 3600).toFixed(2).replace('.', ',')}{duracao ? '' : ' por hora'}. Leva alguns minutos; deixe a aba aberta.</span>
                  <button type="button" className="btn btn-ouro btn-mini" disabled={!!ocupado} onClick={transcrever}>Transcrever</button>
                </>)}
              </li>
              <li className={!t ? '' : cortes.length ? 'feita' : 'atual'}>
                <b>2. Encontrar os melhores cortes</b>
                {t && (<div className="ia-linha">
                  <span className="select-icone"><select value={quantos} onChange={(e) => setQuantos(Number(e.target.value))} aria-label="Quantos cortes">
                    {[5, 10, 15, 20].map((n) => <option key={n} value={n}>Até {n} cortes</option>)}</select></span>
                  <button type="button" className={`btn ${cortes.length ? 'btn-contorno-ouro' : 'btn-ouro'} btn-mini`} disabled={!!ocupado} onClick={encontrar}>{cortes.length ? 'Procurar de novo' : 'Encontrar cortes'}</button>
                  <span className="muted pequeno">Cerca de R$ 0,30 a R$ 1,50 (depende da duração).</span>
                </div>)}
              </li>
              <li className={cortes.length ? 'atual' : ''}><b>3. Escolher e criar os vídeos</b></li>
            </ol>
            {ocupado && <div className="progresso"><div className={ocupado.fracao == null ? 'indeterminado' : 'ev-barra'}>{ocupado.fracao != null && <span style={{ width: `${Math.round(ocupado.fracao * 100)}%` }} />}</div><span>{ocupado.texto}</span></div>}
          </section>

          {cortes.length > 0 && (
            <section className="bloco cortes-lista">
              <div className="ed-lista-topo"><h2>{cortes.length} cortes propostos</h2>
                <button type="button" className="btn btn-ouro" disabled={!marcados || !!ocupado} onClick={criar}><Icone nome="floco" tam={15} /> Criar {marcados} vídeo(s) para editar</button></div>
              <ul>{cortes.map((c, k) => (
                <li key={`${c.de}-${k}`} className={`corte${c.marcado ? ' marcado' : ''}`}>
                  <label className="corte-marca"><input type="checkbox" checked={c.marcado} onChange={(e) => mudar(k, { marcado: e.target.checked })} /></label>
                  <div className="corte-corpo">
                    <div className="corte-titulo"><b>{c.titulo}</b><span className="selo-neutro">{NOME_TIPO[c.tipo ?? ''] ?? 'Trecho'}</span><span className={`corte-nota n${Math.min(10, Math.max(1, c.nota))}`}>{c.nota}/10</span></div>
                    <p className="pequeno">"{c.gancho}"</p>
                    <p className="muted pequeno">{c.por_que}</p>
                    <div className="ia-linha pequeno">
                      <button type="button" className="btn btn-mini" onClick={() => assistir(k)}><Icone nome="video" tam={13} /> {tocando === k ? 'Pausar' : 'Assistir'}</button>
                      <span>{mmss(c.de)} – {mmss(c.ate)} · {Math.round(c.ate - c.de)} s</span>
                      <span className="corte-ajuste">Início <button type="button" onClick={() => mudar(k, { de: Math.max(0, c.de - 1) })}>−1s</button><button type="button" onClick={() => mudar(k, { de: Math.min(c.ate - 5, c.de + 1) })}>+1s</button></span>
                      <span className="corte-ajuste">Fim <button type="button" onClick={() => mudar(k, { ate: Math.max(c.de + 5, c.ate - 1) })}>−1s</button><button type="button" onClick={() => mudar(k, { ate: c.ate + 1 })}>+1s</button></span>
                    </div>
                  </div>
                </li>
              ))}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
