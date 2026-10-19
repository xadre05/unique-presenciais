// Cartão "Instagram" na coluna da direita da peça: o agendamento mais recente (agendado, publicando, publicado com o
// link, erro com o motivo) com cancelar / tentar de novo, e o botão "Agendar no Instagram" quando a peça está aprovada.
// Se a conexão ainda não tem a permissão de publicar, avisa para reconectar.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { EMPRESA } from '../useMarketing'
import { redeDe } from '../redes'
import type { Rascunho } from './modelo'
import { podePublicar, useConexao } from '../../instagram/dados'
import { FORMATO_DA_PECA, cancelar, publicarAgora, usePublicacoesDaPeca, type Publicacao } from '../../instagram/publicacoes'
import { AgendarPublicacao } from './AgendarPublicacao'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const SITUACAO: Record<Publicacao['status'], string> = { agendada: 'Agendado', publicando: 'Publicando…', publicada: 'Publicado', erro: 'Não publicou', cancelada: 'Cancelado' }

export function PublicarPeca({ peca, r, aoMudar }: { peca: Peca; r: Rascunho; aoMudar: () => void }) {
  const conexao = useConexao(EMPRESA)
  const pubs = usePublicacoesDaPeca(EMPRESA, peca.id)
  const [abrir, setAbrir] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const formato = FORMATO_DA_PECA[peca.tipo]
  if (redeDe(peca) !== 'instagram' || !formato) return null
  const c = conexao.dados
  const ultima = (pubs.dados ?? []).find((p) => p.status !== 'cancelada') ?? null
  const fazer = async (acao: () => Promise<unknown>) => { setErro(null); setOcupado(true); try { await acao() } catch (e) { setErro((e as Error).message) } setOcupado(false); pubs.recarregar(); aoMudar() }
  const aprovada = peca.status === 'aprovada' || peca.status === 'postada'
  return (
    <section className="pp-cartao pub-cartao">
      <header><h3><Icone nome="enviar" tam={16} /> Instagram</h3></header>
      {c?.status !== 'conectado' ? <p className="muted pequeno">O Instagram não está ligado. <Link to="/agentes/central?aba=integracoes" className="link">Ligar</Link></p>
        : !podePublicar(c) ? <p className="muted pequeno">Para publicar daqui, o dono da conta precisa <Link to="/agentes/central?aba=integracoes" className="link">conectar de novo</Link> e aceitar a permissão de publicar.</p>
          : (<>
            {ultima && (
              <div className={`pub-situacao ${ultima.status}`}>
                <b>{SITUACAO[ultima.status]}</b>
                <small className="muted">{ultima.status === 'publicada' && ultima.publicado_em ? `em ${quando(ultima.publicado_em)}` : ultima.status === 'agendada' ? `para ${quando(ultima.quando)}` : ''}</small>
                {ultima.erro && <small className="erro-txt">{ultima.erro}</small>}
                <div className="ia-linha">
                  {ultima.status === 'publicada' && ultima.link && <a href={ultima.link} target="_blank" rel="noreferrer" className="btn btn-mini">Ver no Instagram</a>}
                  {ultima.status === 'agendada' && <><button type="button" className="btn btn-mini" disabled={ocupado} onClick={() => fazer(() => publicarAgora(EMPRESA, ultima.id))}>Publicar agora</button>
                    <button type="button" className="btn btn-mini" disabled={ocupado} onClick={() => fazer(() => cancelar(ultima.id))}>Cancelar</button></>}
                  {ultima.status === 'erro' && <button type="button" className="btn btn-mini" disabled={ocupado} onClick={() => fazer(() => publicarAgora(EMPRESA, ultima.id))}>Tentar de novo</button>}
                  {ultima.status === 'publicando' && <button type="button" className="btn btn-mini" onClick={() => pubs.recarregar()}>Atualizar</button>}
                </div>
              </div>
            )}
            {(!ultima || ultima.status === 'publicada' || ultima.status === 'erro') && (aprovada
              ? <button type="button" className="btn btn-ouro" onClick={() => setAbrir(true)}><Icone nome="agenda" tam={15} /> {ultima?.status === 'publicada' ? 'Agendar de novo' : 'Agendar no Instagram'}</button>
              : <p className="muted pequeno">Aprove a peça para agendar a publicação.</p>)}
          </>)}
      {erro && <p className="erro-txt pequeno">{erro}</p>}
      {abrir && formato && <AgendarPublicacao peca={peca} r={r} formato={formato} usuario={c?.usuario ?? null} aoFechar={() => setAbrir(false)} aoAgendar={() => { setAbrir(false); pubs.recarregar(); aoMudar() }} />}
    </section>
  )
}
