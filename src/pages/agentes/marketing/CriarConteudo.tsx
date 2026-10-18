// Criar conteúdo: escolher o período (peça única, um dia, uma semana ou período), os canais e formatos,
// e então "Salvar planejamento" (vira ideias, sem custo) ou "Gerar rascunhos" (o agente escreve).
// Regras em docs/agentes/REGRAS_AGENTE_MARKETING.md.
import { useEffect, useState } from 'react'
import { Campo, Erro, Modal } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { AnexosPedido, type Anexo } from '../AnexosPedido'
import { hojeISO, segundaDe, somaDias } from '../comum'
import { LinhasConteudo, novaLinha, type LinhaConteudo } from './LinhasConteudo'
import { REDES, ehVideo, nomeFormato } from './redes'
import { pedirTrabalho, type Campanha } from './useMarketing'

export type ModoCriar = 'peca' | 'dia' | 'semana' | 'periodo'
const MODOS: { id: ModoCriar; nome: string; icone: string }[] = [
  { id: 'peca', nome: 'Peça única', icone: 'documento' }, { id: 'dia', nome: 'Um dia', icone: 'agenda' },
  { id: 'semana', nome: 'Uma semana', icone: 'agenda' }, { id: 'periodo', nome: 'Período', icone: 'agenda' },
]
export const OBJETIVOS = ['Educar e gerar interesse', 'Relacionamento e confiança', 'Autoridade e prova social', 'Vender uma oferta', 'Bastidores e rotina']
export const PUBLICOS = ['Profissionais de HOF', 'Quem quer começar na HOF', 'Alunos e ex-alunos', 'Público em geral']
const LIMITE_GERAR = 40

function datasDo(modo: ModoCriar, inicio: string, fim: string) {
  const n = modo === 'semana' ? 7 : modo === 'periodo' ? Math.max(1, Math.min(62, Math.round((new Date(fim + 'T12:00:00').getTime() - new Date(inicio + 'T12:00:00').getTime()) / 86400000) + 1)) : 1
  return Array.from({ length: n }, (_, i) => somaDias(inicio, i))
}

type Props = {
  aberto: boolean; aoFechar: () => void; modoInicial: ModoCriar; dataInicial: string
  campanhas: Campanha[]; campanhaPadrao: string; aoCriarCampanha: () => void; aoPronto: () => void
}

export function CriarConteudo({ aberto, aoFechar, modoInicial, dataInicial, campanhas, campanhaPadrao, aoCriarCampanha, aoPronto }: Props) {
  const [modo, setModo] = useState<ModoCriar>(modoInicial)
  const [inicio, setInicio] = useState(dataInicial)
  const [fim, setFim] = useState(somaDias(dataInicial, 13))
  const [campanha, setCampanha] = useState(campanhaPadrao)
  const [objetivo, setObjetivo] = useState(OBJETIVOS[0])
  const [publico, setPublico] = useState(PUBLICOS[0])
  const [linhas, setLinhas] = useState<LinhaConteudo[]>([novaLinha('instagram', 'carrossel')])
  const [tema, setTema] = useState('')
  const [orientacao, setOrientacao] = useState('')
  const [adaptar, setAdaptar] = useState(true)
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<'salvar' | 'gerar' | null>(null)
  const [aberturaFeita, setAberturaFeita] = useState(false)
  useEffect(() => {
    if (!aberto) return
    setCampanha(campanhaPadrao)
    // ao voltar de "Nova campanha", mantém o que já estava preenchido
    if (!aberturaFeita) { escolherModo(modoInicial, dataInicial); setErro(null); setAberturaFeita(true) }
  }, [aberto, campanhaPadrao]) // eslint-disable-line react-hooks/exhaustive-deps

  function escolherModo(m: ModoCriar, base = inicio) {
    setModo(m)
    setInicio(m === 'semana' ? segundaDe(base) : base)
    if (m === 'peca') setLinhas((ls) => [{ ...ls[0], qtd: 1 }])
  }
  const fechar = () => { setAberturaFeita(false); aoFechar() }
  const datas = datasDo(modo, inicio, fim)
  const porSemana = modo === 'semana' || modo === 'periodo'
  // cada linha vira N peças em cada dia escolhido
  const pecas = datas.flatMap((dia) => linhas.flatMap((l) => {
    const diaSemana = new Date(dia + 'T12:00:00').getDay()
    if (porSemana && !l.diasSemana.includes(diaSemana)) return []
    return Array.from({ length: modo === 'peca' ? 1 : l.qtd }, () => ({
      tipo: l.formato, rede: l.rede, dia, campanha: campanha || undefined,
      titulo: tema.trim() ? tema.trim().slice(0, 70) : `${nomeFormato(l.formato, l.rede)} · ${REDES[l.rede].nome}`,
      tema: tema.trim(), briefing: { objetivo, publico, telas: l.formato === 'stories' ? l.telas : undefined, duracao: ehVideo(l.formato) ? l.duracao : undefined, orientacao: ehVideo(l.formato) ? orientacao.trim() || undefined : undefined },
    }))
  }))
  const canais = new Set(linhas.map((l) => l.rede)).size
  const diasComPeca = new Set(pecas.map((p) => p.dia)).size
  const temVideo = linhas.some((l) => ehVideo(l.formato))

  const enviar = async (gerar: boolean) => {
    setErro(null)
    if (!pecas.length) return setErro('Nenhuma peça para criar. Confira os canais e os dias.')
    setEnviando(gerar ? 'gerar' : 'salvar')
    const c = campanhas.find((x) => x.id === campanha) ?? null
    const msg = gerar
      ? await pedirTrabalho('escrever', { novas: pecas, adaptar, tema: tema.trim() || null, objetivo, publico, campanha: c, orientacao: orientacao.trim() || null, anexos })
      : await pedirTrabalho('ideia', { pecas })
    setEnviando(null)
    if (msg) return setErro(msg)
    setTema(''); setAnexos([]); setAberturaFeita(false); aoPronto()
  }

  return (
    <Modal titulo="Criar conteúdo" aberto={aberto} onFechar={fechar} largo>
      <div className="mk-form">
        <p className="muted mk-criar-sub">Escolha o período, os canais e o que deseja produzir.</p>
        <div className="mk-modos">{MODOS.map((m) => <button key={m.id} type="button" className={modo === m.id ? 'ativa' : ''} onClick={() => escolherModo(m.id)}><Icone nome={m.icone} tam={18} /> {m.nome}</button>)}</div>
        <div className="form-duas">
          {modo === 'periodo'
            ? <div className="form-duas"><Campo rotulo="De"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo><Campo rotulo="Até"><input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} /></Campo></div>
            : <Campo rotulo={modo === 'semana' ? 'Semana que começa em' : 'Data'}><input type="date" value={inicio} onChange={(e) => setInicio(modo === 'semana' ? segundaDe(e.target.value) : e.target.value)} /></Campo>}
          <Campo rotulo="Campanha (opcional)">
            <select value={campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha() : setCampanha(e.target.value))}>
              <option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__nova">+ Nova campanha…</option>
            </select>
          </Campo>
          <Campo rotulo="Objetivo"><select value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</select></Campo>
          <Campo rotulo="Público"><select value={publico} onChange={(e) => setPublico(e.target.value)}>{PUBLICOS.map((o) => <option key={o}>{o}</option>)}</select></Campo>
        </div>

        <div className="mk-criar-cab"><h3>O que vamos criar?</h3><span className="muted pequeno"><Icone nome="info" tam={14} /> Os formatos mudam conforme o canal escolhido.</span></div>
        <LinhasConteudo linhas={linhas} mudar={setLinhas} unica={modo === 'peca'} porSemana={porSemana} />

        <Campo rotulo="Tema ou orientação" dica={`${tema.length}/1.000`}><textarea rows={3} maxLength={1000} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: apresentar como a formação e a mentoria apoiam a evolução profissional" /></Campo>
        {temVideo && <Campo rotulo="Orientações para os vídeos (opcional)" dica="Ex.: gravo sozinha com o celular, fala para a câmera, sem edição complexa"><textarea rows={2} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} /></Campo>}
        <div className="mk-criar-extra">
          <AnexosPedido anexos={anexos} aoMudar={setAnexos} />
          {canais > 1 && <label className="mk-adaptar"><input type="checkbox" checked={adaptar} onChange={(e) => setAdaptar(e.target.checked)} /><span><b>Adaptar a abordagem para cada canal</b><br /><span className="muted pequeno">Uma ideia central, com abertura, roteiro e chamada próprios.</span></span></label>}
        </div>
        <Erro msg={erro} />
        <footer className="mk-criar-rodape">
          <span className="mk-criar-resumo"><Icone nome="grafico" tam={20} /><span><b>{pecas.length} {pecas.length === 1 ? 'peça' : 'peças'} • {diasComPeca} {diasComPeca === 1 ? 'dia' : 'dias'} • {canais} {canais === 1 ? 'canal' : 'canais'}</b><br /><span className="muted pequeno">Não há publicação automática.</span></span></span>
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn btn-contorno-ouro" disabled={!!enviando || !pecas.length} onClick={() => enviar(false)} title="Cria as peças como ideias, sem custo. O agente escreve quando você pedir.">{enviando === 'salvar' ? 'Salvando…' : 'Salvar planejamento'}</button>
          <button className="btn btn-ouro" disabled={!!enviando || !pecas.length || pecas.length > LIMITE_GERAR} title={pecas.length > LIMITE_GERAR ? `Até ${LIMITE_GERAR} peças por vez: salve o planejamento e gere em partes.` : ''} onClick={() => enviar(true)}>{enviando === 'gerar' ? 'Enviando…' : `Gerar ${pecas.length} ${pecas.length === 1 ? 'rascunho' : 'rascunhos'}`}</button>
        </footer>
      </div>
    </Modal>
  )
}

export const dataPadraoCriar = (modo: ModoCriar, base: string) => (modo === 'semana' ? segundaDe(base) : base || hojeISO())
