// A semana montada em quadro: uma coluna por dia, cada peça um cartão pequeno; clicando, a peça abre embaixo.
import { useState } from 'react'
import type { Peca } from './comum'
import { TIPO_PECA } from './comum'
import { PecaCartao } from './PecaCartao'

const COR_TIPO: Record<string, string> = { post: '#d9a24b', carrossel: '#a46ee6', reels: '#e5534b', stories: '#2fb3a0' }
const STATUS_TXT: Record<Peca['status'], string> = { rascunho: 'Para aprovar', aprovada: 'Aprovada', descartada: 'Descartada', postada: 'Postada' }

function diasDaSemana(inicio: string) {
  const base = new Date(inicio + 'T12:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i)
    return { iso: d.toISOString().slice(0, 10), nome: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  })
}

export function SemanaQuadro({ inicio, pecas, aoMudar }: { inicio: string; pecas: Peca[]; aoMudar: () => void }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const dias = diasDaSemana(inicio)
  const semDia = pecas.filter((p) => !p.dia || !dias.some((d) => d.iso === p.dia))
  const selecionada = pecas.find((p) => p.id === aberta) ?? null
  const contagem = (s: Peca['status']) => pecas.filter((p) => p.status === s).length

  return (
    <div className="semana">
      <div className="semana-resumo">
        <span><b>{pecas.length}</b> peças</span>
        <span className="tom-alerta"><b>{contagem('rascunho')}</b> para aprovar</span>
        <span className="tom-ok"><b>{contagem('aprovada')}</b> aprovadas</span>
        <span><b>{contagem('postada')}</b> postadas</span>
        <span className="semana-legenda">{Object.entries(COR_TIPO).map(([t, c]) => <i key={t} style={{ ['--cor-tipo' as string]: c }}>{TIPO_PECA[t]}</i>)}</span>
      </div>
      <div className="semana-quadro">
        {[...dias, ...(semDia.length ? [{ iso: '', nome: 'sem dia', data: '' }] : [])].map((d) => {
          const doDia = d.iso ? pecas.filter((p) => p.dia === d.iso) : semDia
          return (
            <div key={d.iso || 'sem'} className="semana-dia">
              <header><b>{d.nome}</b><span>{d.data}</span></header>
              {doDia.map((p) => (
                <button key={p.id} className={`semana-peca st-${p.status}${aberta === p.id ? ' aberta' : ''}`} style={{ ['--cor-tipo' as string]: COR_TIPO[p.tipo] ?? '#888' }} onClick={() => setAberta(aberta === p.id ? null : p.id)}>
                  <span className="semana-tipo">{TIPO_PECA[p.tipo] ?? p.tipo}{p.tipo === 'stories' && p.conteudo.roteiro?.length ? ` · ${p.conteudo.roteiro.length}` : ''}</span>
                  <span className="semana-titulo">{p.titulo.replace(/^(Stories|Reels|Post|Carrossel)\s*\d*\s*[–:-]\s*/i, '')}</span>
                  <span className="semana-st">{STATUS_TXT[p.status]}</span>
                </button>
              ))}
              {!doDia.length && <span className="semana-vazio">—</span>}
            </div>
          )
        })}
      </div>
      {selecionada
        ? <div className="semana-aberta"><PecaCartao key={selecionada.id} peca={selecionada} aoMudar={aoMudar} /></div>
        : <p className="muted pequeno semana-dica">Clique numa peça para ler, editar, copiar ou aprovar.</p>}
    </div>
  )
}
