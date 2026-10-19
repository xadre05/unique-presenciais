// Formulário de uma referência nova: de onde vem (categoria), o formato, de quem, o link, os prints ou o vídeo
// baixado, o texto da peça e, o mais importante, o que a equipe quer copiar dali. Ao guardar, o agente escreve a ficha.
import { useRef, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { CATEGORIAS, FORMATOS, guardarReferencia, pedirFicha, type NovaRef } from './dados'

const MAX_PRINTS = 10
const MAX_VIDEO_MB = 300
const vazia = (): NovaRef => ({ categoria: 'concorrente', formato: 'reels', autor: '', link: '', por_que: '', texto: '' })

type Props = { empresa: string; aoGuardar: () => void; aoCancelar: () => void }

export function NovaReferencia({ empresa, aoGuardar, aoCancelar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [r, setR] = useState(vazia)
  const [prints, setPrints] = useState<File[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (x: Partial<NovaRef>) => setR((v) => ({ ...v, ...x }))

  const escolher = (lista: FileList | null) => {
    setErro(null)
    for (const f of Array.from(lista ?? [])) {
      if (f.type.startsWith('video/')) {
        if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setErro(`${f.name}: vídeo acima de ${MAX_VIDEO_MB} MB.`); continue }
        setVideo(f); if (r.formato === 'carrossel' || r.formato === 'post') mudar({ formato: 'reels' })
      } else if (f.type.startsWith('image/')) setPrints((p) => (p.length >= MAX_PRINTS ? p : [...p, f]))
      else setErro(`${f.name}: envie imagem (print) ou vídeo.`)
    }
    if (entrada.current) entrada.current.value = ''
  }

  const guardar = async () => {
    if (!prints.length && !video && !r.texto.trim()) return setErro('Envie pelo menos um print, o vídeo ou o texto da peça.')
    setErro(null)
    try {
      const id = await guardarReferencia(empresa, r, prints, video, setEtapa)
      setEtapa('O agente está estudando (até 1 minuto)…')
      aoGuardar()
      await pedirFicha(empresa, id).catch(() => undefined) // o erro fica gravado na própria referência
      setEtapa(null); aoGuardar(); aoCancelar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível guardar.'); setEtapa(null) }
  }

  return (
    <div className="mk-form ref-form">
      <label>De onde vem</label>
      <div className="ia-linha" role="radiogroup">{CATEGORIAS.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={r.categoria === c.id} title={c.dica} className={`mk-chip${r.categoria === c.id ? ' ativo' : ''}`} onClick={() => mudar({ categoria: c.id })}>{c.nome}</button>))}</div>
      <div className="form-duas">
        <label>Formato<select value={r.formato} onChange={(e) => mudar({ formato: e.target.value as NovaRef['formato'] })}>{FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
        <label>De quem<input value={r.autor} maxLength={120} onChange={(e) => mudar({ autor: e.target.value })} placeholder="@perfil ou nome" /></label>
      </div>
      <label>Link <small className="muted">(opcional, para abrir depois)</small><input value={r.link} maxLength={500} onChange={(e) => mudar({ link: e.target.value })} placeholder="https://www.instagram.com/reel/…" /></label>
      <div className="ref-arquivos">
        <button type="button" className="btn btn-contorno btn-mini" onClick={() => entrada.current?.click()}><Icone nome="arquivo" tam={14} /> Prints ou vídeo</button>
        <span className="muted pequeno">Carrossel: um print por lâmina. Reels: o vídeo baixado (o sistema tira 10 quadros do vídeo; o vídeo não fica guardado).</span>
        <input ref={entrada} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => escolher(e.target.files)} />
        {(prints.length > 0 || video) && <ul className="ref-escolhidos">
          {video && <li><Icone nome="video" tam={14} /> {video.name}<button type="button" className="btn btn-mini" onClick={() => setVideo(null)} aria-label="Tirar vídeo"><Icone nome="fechar" tam={12} /></button></li>}
          {prints.map((p, i) => <li key={i}><Icone nome="imagem" tam={14} /> {p.name}<button type="button" className="btn btn-mini" onClick={() => setPrints((l) => l.filter((_, j) => j !== i))} aria-label="Tirar print"><Icone nome="fechar" tam={12} /></button></li>)}
        </ul>}
      </div>
      <label>Texto da peça <small className="muted">(opcional: a legenda, o texto das lâminas ou o que a pessoa fala no vídeo)</small>
        <textarea rows={3} maxLength={6000} value={r.texto} onChange={(e) => mudar({ texto: e.target.value })} /></label>
      <label>O que você quer copiar daqui? <small className="muted">(o mais importante)</small>
        <textarea rows={3} maxLength={1500} value={r.por_que} onChange={(e) => mudar({ por_que: e.target.value })} placeholder="Ex.: o gancho da primeira frase; a tela dividida ao meio; a legenda que aparece palavra por palavra; o jeito de falar olhando para a câmera" /></label>
      <p className="muted pequeno">Ao guardar, o agente estuda a peça sozinho e passa a usar o formato quando escrever. Ele copia a forma, nunca as frases, os dados ou a marca de quem fez.</p>
      <Erro msg={erro} />
      <div className="ia-linha">
        <button type="button" className="btn btn-ouro" disabled={!!etapa} onClick={guardar}><Icone nome="floco" tam={15} /> {etapa ?? 'Guardar referência'}</button>
        <button type="button" className="btn btn-mini" disabled={!!etapa} onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  )
}
