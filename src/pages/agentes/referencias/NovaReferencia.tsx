// Nova referência de criação, em página própria: 1) identificação (nome, origem, canal, formato, de quem, link),
// 2) material (prints, vídeo ou texto) e 3) o que copiar e como usar na nossa marca. Um botão só: ao guardar,
// o agente estuda sozinho e passa a usar o formato. Ele copia a forma, nunca as frases, os dados ou a marca de quem fez.
import { useRef, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { REDES, TODAS_REDES } from '../marketing/redes'
import { CATEGORIAS, FORMATOS, guardarReferencia, pedirFicha, type NovaRef } from './dados'

const MAX_PRINTS = 10
const MAX_VIDEO_MB = 300
const vazia = (): NovaRef => ({ nome: '', canal: 'instagram', categoria: 'concorrente', formato: 'reels', autor: '', link: '', por_que: '', texto: '' })

type Props = { empresa: string; aoGuardar: () => void; aoVoltar: () => void }

function Arquivos({ prints, video, aoEscolher, aoTirarPrint, aoTirarVideo }: { prints: File[]; video: File | null; aoEscolher: (l: FileList | null) => void; aoTirarPrint: (i: number) => void; aoTirarVideo: () => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className="ref-soltar" onClick={() => entrada.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); aoEscolher(e.dataTransfer.files) }}>
        <span className="ref-soltar-ico"><Icone nome="importar" tam={20} /></span>
        <b>Adicionar imagens ou vídeo</b>
        <small className="muted">Carrossel: um print por lâmina. Reels: o vídeo baixado (o sistema tira 10 quadros; o vídeo não fica guardado).</small>
      </button>
      <input ref={entrada} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { aoEscolher(e.target.files); e.target.value = '' }} />
      {(prints.length > 0 || video) && <ul className="ref-escolhidos">
        {video && <li><Icone nome="video" tam={14} /> {video.name}<button type="button" className="btn btn-mini" onClick={aoTirarVideo} aria-label="Tirar vídeo"><Icone nome="fechar" tam={12} /></button></li>}
        {prints.map((p, i) => <li key={i}><Icone nome="imagem" tam={14} /> {p.name}<button type="button" className="btn btn-mini" onClick={() => aoTirarPrint(i)} aria-label="Tirar print"><Icone nome="fechar" tam={12} /></button></li>)}
      </ul>}
    </>
  )
}

export function NovaReferencia({ empresa, aoGuardar, aoVoltar }: Props) {
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
  }
  const guardar = async () => {
    if (!prints.length && !video && !r.texto.trim()) return setErro('Envie pelo menos um print, o vídeo ou o texto da peça.')
    setErro(null)
    try {
      const id = await guardarReferencia(empresa, r, prints, video, setEtapa)
      setEtapa('O agente está estudando (até 1 minuto)…')
      aoGuardar()
      await pedirFicha(empresa, id).catch(() => undefined) // o erro fica gravado na própria referência
      setEtapa(null); aoGuardar(); aoVoltar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível guardar.'); setEtapa(null) }
  }
  const tem = prints.length > 0 || !!video || !!r.texto.trim()

  return (
    <div className="ref-pagina">
      <button type="button" className="link ref-voltar" onClick={aoVoltar} disabled={!!etapa}><Icone nome="esquerda" tam={15} /> Voltar às referências</button>
      <h2 className="ref-h">Nova referência de criação</h2>
      <p className="muted">Um post, reels ou texto de outra pessoa que vocês gostariam de ter feito. Só esta empresa vê.</p>
      <div className="bm-grade">
        <div className="bm-principal">
          <section className="bm-cartao mk-form">
            <h3>1. Identificação</h3>
            <div className="form-duas">
              <label>Nome da referência<input value={r.nome} maxLength={120} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: vídeo com abertura em pergunta" /></label>
              <label>Origem<select value={r.categoria} onChange={(e) => mudar({ categoria: e.target.value as NovaRef['categoria'] })}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
              <label>Canal<select value={r.canal} onChange={(e) => mudar({ canal: e.target.value })}>{TODAS_REDES.map((x) => <option key={x} value={x}>{REDES[x].nome}</option>)}</select></label>
              <label>Formato<select value={r.formato} onChange={(e) => mudar({ formato: e.target.value as NovaRef['formato'] })}>{FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
              <label>Autor ou perfil<input value={r.autor} maxLength={120} onChange={(e) => mudar({ autor: e.target.value })} placeholder="@perfil" /></label>
              <label>Link <small className="muted">(opcional)</small><input value={r.link} maxLength={500} onChange={(e) => mudar({ link: e.target.value })} placeholder="https://" /></label>
            </div>
          </section>
          <section className="bm-cartao mk-form">
            <h3>2. Material de referência</h3>
            <Arquivos prints={prints} video={video} aoEscolher={escolher} aoTirarPrint={(i) => setPrints((l) => l.filter((_, j) => j !== i))} aoTirarVideo={() => setVideo(null)} />
            <label>Texto ou transcrição <small className="muted">(opcional)</small>
              <textarea rows={3} maxLength={6000} value={r.texto} onChange={(e) => mudar({ texto: e.target.value })} placeholder="Cole a legenda, o texto das lâminas ou a fala do vídeo…" /></label>
          </section>
          <section className="bm-cartao mk-form">
            <h3>3. O que copiar e como usar na nossa marca</h3>
            <label><span className="muted pequeno">O mais importante: diga o que chamou atenção. O agente dá peso a isto.</span>
              <textarea rows={3} maxLength={1500} value={r.por_que} onChange={(e) => mudar({ por_que: e.target.value })} placeholder="Ex.: o gancho da primeira frase em forma de pergunta; abrir com uma dúvida comum de dentistas e responder com uma explicação prática" /></label>
          </section>
        </div>
        <aside className="bm-lado-col">
          <section className="bm-cartao">
            <h3>Como o agente usa</h3>
            <ul className="bib-como">
              <li><Icone nome="floco" tam={18} /> Ao guardar, ele estuda a peça sozinho: gancho, estrutura, visual, texto na tela e ritmo.</li>
              <li><Icone nome="ideia" tam={18} /> Quando escrever uma peça do mesmo formato, segue essa forma com o conteúdo da marca.</li>
              <li><Icone nome="alerta" tam={18} /> Nunca copia frases, dados, marca ou bordões de quem fez.</li>
            </ul>
          </section>
        </aside>
      </div>
      <div className="bm-barra pendente">
        <span className="muted"><Icone nome="relogio" tam={15} /> {etapa ?? (tem ? 'Referência ainda não guardada.' : 'Envie um print, o vídeo ou o texto da peça.')}</span>
        <span className="ia-linha">
          <button type="button" className="btn" disabled={!!etapa} onClick={aoVoltar}>Cancelar</button>
          <button type="button" className="btn btn-ouro" disabled={!!etapa} onClick={guardar}><Icone nome="floco" tam={15} /> Guardar referência</button>
        </span>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
