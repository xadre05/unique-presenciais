// Vídeo sem gravar (/agentes/editor/sem-gravar): a pessoa escreve o texto, escolhe a voz e a IA narra. Depois o
// Agente Editor monta o vídeo inteiro com cenas animadas e mídias por cima da narração, no Estúdio de sempre.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { Voltar } from '../../../../components/Voltar'
import { BotaoAjuda } from '../../ajuda/BotaoAjuda'
import { EMPRESA } from '../../marketing/useMarketing'
import { useLogos } from '../../LogosMarca'
import { listarVozes, type Voz } from '../ia/servicos'
import { criarVideoSemGravar, custoNarracao, gerarNarracao, type Previa } from './dados'

const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SemGravar() {
  const ir = useNavigate()
  const amostra = useRef<HTMLAudioElement | null>(null)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [finalidade, setFinalidade] = useState<'anuncio' | 'organico'>('organico')
  const campanhas = ((useLogos(EMPRESA).dados?.perfil?.campanhas ?? []) as { id: string; nome: string; encerrada?: boolean }[]).filter((c) => !c.encerrada)
  const [campanha, setCampanha] = useState('')
  const [vozes, setVozes] = useState<Voz[] | null>(null)
  const [voz, setVoz] = useState('')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { void listarVozes().then((r) => { setVozes(r.vozes); if (r.vozes[0]) setVoz(r.vozes[0].id) }).catch((e) => { setVozes([]); setErro((e as Error).message) }) }, [])
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url) }, [previa])
  const ouvir = (v: Voz) => { amostra.current?.pause(); if (v.amostra) { amostra.current = new Audio(v.amostra); void amostra.current.play() } }
  const fazer = async (rotulo: string, f: () => Promise<void>) => { setErro(null); setOcupado(rotulo); try { await f() } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) } }
  const narrar = () => fazer('A IA está narrando…', async () => { setPrevia(await gerarNarracao(texto, voz)) })
  const criar = () => fazer('Criando o vídeo…', async () => { const id = await criarVideoSemGravar({ titulo, finalidade, campanha: campanha || undefined, texto, voz }, previa!); ir(`/agentes/editor/video/${id}`) })
  const segundos = Math.round(texto.trim().split(/\s+/).filter(Boolean).length / 2.6)

  return (
    <div className="pagina sem-gravar">
      <div className="migalha"><Voltar para="/agentes/editor" texto="Agente Editor de Vídeo" /></div>
      <header className="cortes-topo">
        <h1>Vídeo sem gravar <BotaoAjuda id="sem-gravar" /></h1>
        <p className="muted">Escreva o texto, escolha a voz e a IA narra. O agente monta o vídeo inteiro com cenas animadas e imagens da marca por cima da narração.</p>
      </header>
      <Erro msg={erro} />
      <section className="bloco sg-form">
        <label className="campo"><span>Título do vídeo</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 3 erros no preenchimento labial" /></label>
        <label className="campo"><span>Texto da narração <small className="muted">({texto.length}/5000 · cerca de {segundos} s)</small></span>
          <textarea rows={9} maxLength={5000} value={texto} onChange={(e) => { setTexto(e.target.value); setPrevia(null) }} placeholder="Escreva como se fosse falar. Frases curtas funcionam melhor." /></label>
        <div className="bi-duas">
          <label className="campo"><span>Finalidade</span><span className="select-icone"><select value={finalidade} onChange={(e) => setFinalidade(e.target.value as 'anuncio' | 'organico')}>
            <option value="organico">Post no Instagram</option><option value="anuncio">Criativo de anúncio</option></select></span></label>
          <label className="campo"><span>Campanha</span><span className="select-icone"><select value={campanha} onChange={(e) => setCampanha(e.target.value)}>
            <option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span></label>
        </div>
        <div className="campo"><span>Voz</span>
          {vozes === null ? <p className="muted pequeno">Carregando as vozes…</p> : !vozes.length ? <p className="muted pequeno">Cadastre a chave da ElevenLabs em Agentes → Configurações → Inteligências artificiais para ver as vozes.</p> : (
            <ul className="sg-vozes">{vozes.map((v) => (
              <li key={v.id} className={voz === v.id ? 'ativo' : ''}>
                <button type="button" className="sg-voz" onClick={() => { setVoz(v.id); setPrevia(null) }}><b>{v.nome}</b><small className="muted">{v.detalhes || v.tipo}</small></button>
                {v.amostra && <button type="button" className="btn btn-quadrado" aria-label={`Ouvir ${v.nome}`} onClick={() => ouvir(v)}><Icone nome="seta_dir" tam={14} /></button>}
              </li>))}</ul>)}
        </div>
        {previa ? (
          <div className="sg-previa">
            <audio src={previa.url} controls />
            <span className="muted pequeno">{Math.round(previa.duracao)} s de narração</span>
            <div className="ia-linha">
              <button type="button" className="btn btn-ouro" disabled={!titulo.trim() || !!ocupado} onClick={() => void criar()}><Icone nome="floco" tam={15} /> Criar o vídeo e abrir no Estúdio</button>
              <button type="button" className="link pequeno" disabled={!!ocupado} onClick={() => void narrar()}>Narrar de novo</button>
            </div>
          </div>
        ) : (
          <div className="ia-linha">
            <button type="button" className="btn btn-ouro" disabled={!texto.trim() || !voz || !!ocupado} onClick={() => void narrar()}><Icone nome="microfone" tam={15} /> Narrar com esta voz</button>
            {texto.trim() && <span className="muted pequeno">Custo aproximado: {real(custoNarracao(texto))} (ElevenLabs)</span>}
          </div>
        )}
        {ocupado && <p className="pequeno">{ocupado}</p>}
      </section>
    </div>
  )
}
