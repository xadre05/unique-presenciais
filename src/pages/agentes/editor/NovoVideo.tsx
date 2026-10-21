// "Novo vídeo para editar": para os vídeos que não nasceram no Agente de Marketing (ex.: criativos roteirizados fora).
// Cria a peça de reels com o roteiro colado e abre direto a aba Vídeo para escolher o arquivo e editar.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { criarVideo, type NovoVideo as Dados } from './dados'

export function NovoVideo({ campanhas }: { campanhas: { id: string; nome: string }[] }) {
  const ir = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [d, setD] = useState<Dados>({ titulo: '', finalidade: 'anuncio', campanha: campanhas[0]?.id, roteiro: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  if (!aberto) return <button type="button" className="btn btn-ouro" onClick={() => setAberto(true)}><Icone nome="video" tam={16} /> Novo vídeo para editar</button>
  const criar = async () => {
    setErro(null); setCriando(true)
    const r = await criarVideo(d)
    setCriando(false)
    if (r.erro) return setErro(r.erro)
    ir(`/agentes/marketing?peca=${r.id}&edicao=1`)
  }
  return (
    <div className="novo-video">
      <label className="campo"><span>Nome do vídeo</span><input value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} placeholder="Ex.: Criativo Black · você escolhe a data" autoFocus /></label>
      <div className="estilo-grade">
        <label className="campo"><span>Para que é</span><span className="select-icone"><select value={d.finalidade} onChange={(e) => setD({ ...d, finalidade: e.target.value as Dados['finalidade'] })}>
          <option value="anuncio">Criativo de anúncio (ritmo rápido)</option><option value="organico">Post no perfil</option></select></span></label>
        <label className="campo"><span>Campanha</span><span className="select-icone"><select value={d.campanha ?? ''} onChange={(e) => setD({ ...d, campanha: e.target.value || undefined })}>
          <option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span></label>
      </div>
      <label className="campo"><span>Roteiro (opcional)</span>
        <textarea rows={5} value={d.roteiro} onChange={(e) => setD({ ...d, roteiro: e.target.value })} placeholder="Opcional. Cole o roteiro gravado (cenas separadas por uma linha em branco). Se deixar vazio, o agente procura nos roteiros da campanha (suba o PDF com todos em Base da marca → Materiais da campanha, como roteiro) qual foi gravado." /></label>
      <div className="linha-acoes">
        <button type="button" className="btn btn-ouro" disabled={!d.titulo.trim() || criando} onClick={criar}>{criando ? 'Criando…' : 'Criar e escolher o vídeo'}</button>
        <button type="button" className="btn" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
