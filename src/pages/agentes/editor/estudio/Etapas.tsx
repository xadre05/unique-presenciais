// Coluna da esquerda do Estúdio: as quatro etapas do vídeo, cada uma com o que foi escolhido e "Alterar".
import { Icone } from '../../../../components/Icone'
import { useReferenciasVideo } from '../../marketing/edicao/dados'
import { PASSOS, type Estudio, type Passo } from './useEstudio'

const NOME: Record<Passo, string> = { video: 'Vídeo bruto', conteudo: 'Conteúdo', estilo: 'Estilo', imagens: 'Imagens e música' }
const ICONE: Record<Passo, string> = { video: 'video', conteudo: 'documento', estilo: 'lapis', imagens: 'imagem' }
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function resumoDoPasso(e: Estudio, p: Passo, nomeEstilo: string): { feito: boolean; texto: string } {
  switch (p) {
    case 'video': return e.arquivo ? { feito: true, texto: `${e.arquivo.name}${e.duracaoBruto ? ` · ${mmss(e.duracaoBruto)}` : ''}` }
      : e.edicao.arquivo ? { feito: false, texto: `${e.edicao.arquivo.nome}: escolha de novo neste computador` } : { feito: false, texto: 'Falta escolher o vídeo' }
    case 'conteudo': return { feito: true, texto: e.edicao.palavras?.length ? 'Fala transcrita' : 'Objetivo e roteiro (opcional)' }
    case 'estilo': return { feito: true, texto: e.edicao.referencia ? `Referência: ${e.edicao.referencia.nome}` : nomeEstilo }
    case 'imagens': return { feito: true, texto: `${e.apoio.midias.length} mídia(s)${e.edicao.musica ? ' · com música' : ''}` }
  }
}

export function Etapas({ e }: { e: Estudio }) {
  const refs = useReferenciasVideo()
  const nomeEstilo = (refs.dados ?? []).find((r) => r.id === e.modeloRef)?.nome ?? 'Estilo da casa'
  return (
    <aside className="es-etapas">
      <h3>Etapas do seu vídeo</h3>
      <p className="muted pequeno">{e.receita ? 'Revise e, se quiser, ajuste cada etapa.' : 'Confira cada etapa e peça a edição ao agente.'}</p>
      <ol>
        {PASSOS.map((p, i) => {
          const r = resumoDoPasso(e, p, nomeEstilo)
          const aberto = e.passo === p
          return (
            <li key={p} className={`es-etapa${aberto ? ' aberta' : ''}`}>
              <button type="button" className="es-etapa-topo" onClick={() => e.setPasso(aberto ? null : p)} aria-expanded={aberto}>
                <span className="es-num">{i + 1}</span>
                <b>{NOME[p]}</b>
                {r.feito ? <span className="es-ok"><Icone nome="check" tam={12} /></span> : <span className="es-falta" />}
                <span className="link pequeno">{aberto ? 'Fechar' : 'Alterar'}</span>
              </button>
              <div className="es-etapa-resumo"><Icone nome={ICONE[p]} tam={16} /><span>{r.texto}</span></div>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
