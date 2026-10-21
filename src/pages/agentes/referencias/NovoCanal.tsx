// Estudar um canal, em página própria: 1) qual canal e o formato, 2) os vídeos baixados (3 a 10), 3) o que a equipe
// gosta nele. Ao estudar, cada vídeo mostra em que passo está; no fim o agente escreve o padrão do canal.
import { useRef, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { MAX_VIDEOS, estudarCanal, type NovoCanal as Dados } from './canal'

const MAX_VIDEO_MB = 500
const REDES_CANAL = [{ id: 'instagram', nome: 'Instagram' }, { id: 'youtube', nome: 'YouTube' }, { id: 'tiktok', nome: 'TikTok' }]
const vazio = (): Dados => ({ nome: '', rede: 'instagram', formato: 'reels', autor: '', link: '', por_que: '' })

type Props = { empresa: string; aoGuardar: () => void; aoVoltar: () => void }

function Videos({ lista, passos, ocupado, aoEscolher, aoTirar }: { lista: File[]; passos: Record<number, string>; ocupado: boolean; aoEscolher: (l: FileList | null) => void; aoTirar: (i: number) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <>
      {lista.length < MAX_VIDEOS && !ocupado && <button type="button" className="ref-soltar" onClick={() => entrada.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); aoEscolher(e.dataTransfer.files) }}>
        <span className="ref-soltar-ico"><Icone nome="importar" tam={20} /></span>
        <b>Adicionar os vídeos baixados</b>
        <small className="muted">De 3 a {MAX_VIDEOS} vídeos do mesmo canal, de preferência os que você mais gosta. O vídeo não fica guardado: só alguns quadros e a fala.</small>
      </button>}
      <input ref={entrada} type="file" multiple accept="video/*" hidden onChange={(e) => { aoEscolher(e.target.files); e.target.value = '' }} />
      {lista.length > 0 && <ul className="canal-videos">
        {lista.map((f, i) => <li key={`${f.name}-${f.size}`}><Icone nome="video" tam={14} /> <span className="ev-nome">{f.name}</span>
          {passos[i] ? <span className={`pequeno ${passos[i].startsWith('não deu') ? 'ref-erro' : 'muted'}`}>{passos[i]}</span>
            : !ocupado && <button type="button" className="btn btn-mini" onClick={() => aoTirar(i)} aria-label="Tirar vídeo"><Icone nome="fechar" tam={12} /></button>}</li>)}
      </ul>}
    </>
  )
}

export function NovoCanal({ empresa, aoGuardar, aoVoltar }: Props) {
  const [c, setC] = useState(vazio)
  const [videos, setVideos] = useState<File[]>([])
  const [passos, setPassos] = useState<Record<number, string>>({})
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (x: Partial<Dados>) => setC((v) => ({ ...v, ...x }))
  const escolher = (lista: FileList | null) => {
    setErro(null)
    const novos = Array.from(lista ?? []).filter((f) => {
      if (!f.type.startsWith('video/')) { setErro(`${f.name}: envie só vídeos.`); return false }
      if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setErro(`${f.name}: vídeo acima de ${MAX_VIDEO_MB} MB.`); return false }
      return true
    })
    setVideos((v) => [...v, ...novos.filter((f) => !v.some((x) => x.name === f.name && x.size === f.size))].slice(0, MAX_VIDEOS))
  }
  const estudar = async () => {
    if (!c.nome.trim()) return setErro('Dê um nome ao canal (ex.: o @ do perfil).')
    if (videos.length < 2) return setErro('Envie pelo menos 2 vídeos (o ideal é de 3 a 10) para ele achar o que se repete.')
    setErro(null); setPassos({})
    try {
      await estudarCanal(empresa, c, videos, (n, texto) => {
        if (n < 0) setEtapa(`O agente está ${texto}…`)
        else { setPassos((p) => ({ ...p, [n]: texto })); setEtapa(`Vídeo ${n + 1} de ${videos.length}: ${texto}…`) }
      })
      setEtapa(null); aoGuardar(); aoVoltar()
    } catch (e) { setErro((e as Error).message); setEtapa(null); aoGuardar() }
  }

  return (
    <div className="ref-pagina">
      <button type="button" className="link ref-voltar" onClick={aoVoltar} disabled={!!etapa}><Icone nome="esquerda" tam={15} /> Voltar às referências</button>
      <h2 className="ref-h">Estudar um canal</h2>
      <p className="muted">Um canal do YouTube ou um perfil do Instagram de que vocês gostam. O agente estuda vários vídeos e aprende o padrão: gancho, estrutura, edição, legenda e jeito de falar.</p>
      <div className="bm-grade">
        <div className="bm-principal">
          <section className="bm-cartao mk-form">
            <h3>1. Qual canal</h3>
            <div className="form-duas">
              <label>Nome do canal<input value={c.nome} maxLength={120} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: @perfil ou nome do canal" /></label>
              <label>Onde está<select value={c.rede} onChange={(e) => mudar({ rede: e.target.value, formato: e.target.value === 'youtube' ? 'video' : c.formato })}>{REDES_CANAL.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
              <label>Tipo de vídeo<select value={c.formato} onChange={(e) => mudar({ formato: e.target.value as Dados['formato'] })}><option value="reels">Reels ou shorts (vertical, curto)</option><option value="video">Vídeo longo</option></select></label>
              <label>Link <small className="muted">(opcional)</small><input value={c.link} maxLength={500} onChange={(e) => mudar({ link: e.target.value })} placeholder="https://" /></label>
            </div>
          </section>
          <section className="bm-cartao mk-form">
            <h3>2. Vídeos baixados</h3>
            <Videos lista={videos} passos={passos} ocupado={!!etapa} aoEscolher={escolher} aoTirar={(i) => setVideos((l) => l.filter((_, j) => j !== i))} />
          </section>
          <section className="bm-cartao mk-form">
            <h3>3. O que vocês gostam neste canal</h3>
            <label><span className="muted pequeno">O agente dá peso a isto.</span>
              <textarea rows={3} maxLength={1500} value={c.por_que} onChange={(e) => mudar({ por_que: e.target.value })} placeholder="Ex.: a edição rápida com imagens por cima da fala; o jeito de abrir com uma pergunta; as legendas grandes" /></label>
          </section>
        </div>
        <aside className="bm-lado-col">
          <section className="bm-cartao">
            <h3>Como funciona</h3>
            <ul className="bib-como">
              <li><Icone nome="video" tam={18} /> Baixe os vídeos no celular ou no computador (o sistema não consegue baixar do Instagram nem do YouTube).</li>
              <li><Icone nome="floco" tam={18} /> Para cada vídeo, ele tira quadros, mede o ritmo dos cortes e ouve a fala (até 10 minutos de cada).</li>
              <li><Icone nome="ideia" tam={18} /> Depois escreve o padrão do canal. Ele aparece como estilo no Editor de Vídeo e como modelo para o Agente de Marketing.</li>
              <li><Icone nome="relogio" tam={18} /> Leva cerca de 1 minuto por vídeo. Deixe esta página aberta.</li>
            </ul>
          </section>
        </aside>
      </div>
      <div className="bm-barra pendente">
        <span className="muted"><Icone nome="relogio" tam={15} /> {etapa ?? (videos.length ? `${videos.length} vídeo(s) escolhido(s).` : 'Escolha os vídeos do canal.')}</span>
        <span className="ia-linha">
          <button type="button" className="btn" disabled={!!etapa} onClick={aoVoltar}>Cancelar</button>
          <button type="button" className="btn btn-ouro" disabled={!!etapa} onClick={estudar}><Icone nome="floco" tam={15} /> Estudar o canal</button>
        </span>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
