// O caminho do vídeo no topo do Estúdio: em que ponto ele está (escolher o vídeo → editar → revisar → gerar o final →
// entregar) e UM botão com o próximo passo. Assim ninguém fica parado sem saber o que fazer, nem depois de recarregar.
import { Icone } from '../../../../components/Icone'
import type { Estudio } from './useEstudio'
import { ReabrirBruto } from './ReabrirBruto'

const PASSOS = ['Vídeo', 'Edição do agente', 'Revisar e ajustar', 'Vídeo final', 'Entregar'] as const

function ondeEsta(e: Estudio, entregue: boolean) {
  if (entregue) return 5
  if (e.final) return 4
  if (e.receita && e.confere) return 2
  if (e.receita) return 0 // edição pronta, mas o vídeo precisa ser escolhido de novo neste computador
  if (e.arquivo) return 1
  return 0
}

type Props = { e: Estudio; entregue: boolean; aoConcluir: () => void }

export function Caminho({ e, entregue, aoConcluir }: Props) {
  const atual = ondeEsta(e, entregue)
  const ocupado = !!e.ocupado || e.progresso !== null
  return (
    <section className="es-caminho" aria-label="Caminho do vídeo">
      <ol>
        {PASSOS.map((nome, k) => {
          const feito = k < atual || (k === 1 && !!e.receita) // a edição já feita continua feita mesmo com o vídeo a reabrir
          return (
            <li key={nome} className={feito ? 'feito' : k === atual ? 'agora' : ''}>
              <span className="es-caminho-num">{feito ? <Icone nome="check" tam={12} /> : k + 1}</span>{nome}
            </li>
          )
        })}
      </ol>
      <div className="es-caminho-acao">
        {ocupado ? <span className="muted pequeno">Trabalhando… acompanhe no meio da tela.</span> : <ProximoPasso e={e} atual={atual} aoConcluir={aoConcluir} />}
      </div>
    </section>
  )
}

function ProximoPasso({ e, atual, aoConcluir }: { e: Estudio; atual: number; aoConcluir: () => void }) {
  if (atual === 5) return <span className="ok-txt pequeno"><Icone nome="check" tam={14} /> Vídeo entregue</span>
  if (atual === 0 && (e.receita || e.edicao.arquivo)) return <>
    <span className="muted pequeno">A edição está guardada. Falta só abrir o vídeo neste computador:</span>
    <ReabrirBruto pecaId={e.pecaId} nomeEsperado={e.edicao.arquivo?.nome} aoEscolher={e.escolher} />
  </>
  if (atual === 0) return <button type="button" className="btn btn-ouro btn-mini" onClick={() => e.setPasso('video')}>Escolher o vídeo <Icone nome="seta_dir" tam={14} /></button>
  if (atual === 1) return <>
    <span className="muted pequeno">Confira o roteiro, o estilo e as imagens, e peça a edição.</span>
    <button type="button" className="btn btn-ouro btn-mini" onClick={() => e.setPasso('imagens')}>Revisar e editar <Icone nome="seta_dir" tam={14} /></button>
  </>
  if (atual === 2) return <>
    <span className="muted pequeno">Assista à prévia. Não gostou de algo? Peça à direita. Gostou?</span>
    <button type="button" className="btn btn-ouro btn-mini" onClick={() => void e.gerarFinal()}><Icone nome="floco" tam={14} /> Gerar vídeo final</button>
  </>
  return <>
    <span className="muted pequeno">Vídeo final pronto: baixe ou entregue.</span>
    <button type="button" className="btn btn-ouro btn-mini" onClick={aoConcluir}>Concluir e entregar <Icone nome="seta_dir" tam={14} /></button>
  </>
}
