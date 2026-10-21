// Botão "Agendar no Instagram" da aba Vídeo: abre o agendamento já com o vídeo escolhido (o que veio pronto ou o
// editado pelo Agente Editor). Avisa quando falta aprovar a peça ou ligar o Instagram.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { EMPRESA } from '../useMarketing'
import { redeDe } from '../redes'
import type { Rascunho } from '../peca/modelo'
import { AgendarPublicacao } from '../peca/AgendarPublicacao'
import { podePublicar, useConexao } from '../../instagram/dados'
import { FORMATO_DA_PECA } from '../../instagram/publicacoes'

export function PublicarVideo({ peca, r, arquivo, rotulo, aoMudar }: { peca: Peca; r: Rascunho; arquivo: File; rotulo: string; aoMudar: () => void }) {
  const conexao = useConexao(EMPRESA)
  const [abrir, setAbrir] = useState(false)
  const formato = FORMATO_DA_PECA[peca.tipo]
  if (redeDe(peca) !== 'instagram' || !formato) return <p className="muted pequeno">Publicar daqui por enquanto é só no Instagram. Baixe o vídeo e poste no app da rede.</p>
  const c = conexao.dados
  if (c?.status !== 'conectado' || !podePublicar(c)) return <p className="muted pequeno">Para publicar daqui, <Link to="/agentes/central?aba=integracoes" className="link">ligue o Instagram</Link> com a permissão de publicar.</p>
  if (peca.status !== 'aprovada' && peca.status !== 'postada') return <p className="muted pequeno">Aprove a peça (botão no rodapé) para agendar a publicação.</p>
  return (<>
    <button type="button" className="btn btn-ouro" onClick={() => setAbrir(true)}><Icone nome="agenda" tam={15} /> {rotulo}</button>
    {abrir && <AgendarPublicacao peca={peca} r={r} formato={formato} usuario={c.usuario ?? null} videoInicial={arquivo}
      aoFechar={() => setAbrir(false)} aoAgendar={() => { setAbrir(false); aoMudar() }} />}
  </>)
}
