// Rodapé do detalhe da peça: situação do salvamento e a ação da etapa em que a peça está
// (Aprovar texto → Aprovar arte / Concluir gravação → Aprovar peça → Marcar como publicada).
// Na aba Versões, o rodapé vira "Voltar à edição" e "Restaurar versão N".
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { infoFormato } from '../formatos'
import { configDe, type AbaId } from './editor'
import type { Rascunho, Versao } from './modelo'
import { estagioDe } from './progresso'
import type { Estado } from './useEdicao'

type Acoes = { aprovarTexto: () => void; concluirProducao: () => void; aprovarPeca: () => void; publicar: () => void; restaurar: (v: Versao) => void }
type Props = {
  peca: Peca; r: Rascunho; aba: AbaId; estado: Estado; salvar: () => void; acoes: Acoes; ocupado: boolean
  versao: Versao | undefined; atual: Versao | undefined; aoVoltarEdicao: () => void
}

function Rodape({ esquerda, children, nota }: { esquerda: React.ReactNode; children?: React.ReactNode; nota?: string }) {
  return (
    <footer className="pp-rodape">
      <span className="pp-rodape-esq">{esquerda}</span>
      <div className="pp-rodape-dir"><div className="pp-rodape-botoes">{children}</div>{nota && <span className="muted pequeno">{nota}</span>}</div>
    </footer>
  )
}

export function RodapePeca({ peca, r, aba, estado, salvar, acoes, ocupado, versao, atual, aoVoltarEdicao }: Props) {
  const [fora, setFora] = useState(false)
  const cfg = configDe(peca.tipo)
  const s = estagioDe(peca)
  const pendencia = peca.conteudo.pendencia
  const bloqueio = pendencia ? 'Resolva a pendência da oferta antes de aprovar' : ocupado ? 'Aguarde o agente terminar' : ''

  if (aba === 'versoes') return (
    <Rodape esquerda={<><Icone nome="historico" tam={20} /> Restaurar cria uma nova versão e mantém o histórico.</>} nota={versao && versao.n !== atual?.n ? 'O conteúdo restaurado volta para revisão.' : undefined}>
      <button className="btn btn-contorno" onClick={aoVoltarEdicao}>Voltar à edição</button>
      {versao && versao.n !== atual?.n && <button className="btn btn-ouro" disabled={ocupado} onClick={() => acoes.restaurar(versao)}><Icone nome="historico" tam={16} /> Restaurar versão {versao.n}</button>}
    </Rodape>
  )
  if (s === 'ideia' || s === 'descartada') return null

  const esquerda = estado === 'salvando' ? <><Icone nome="atualizar" tam={18} /> Salvando…</>
    : estado === 'alterado' ? <><Icone nome="lapis" tam={18} /> Alterações não salvas</>
      : estado === 'erro' ? <span className="erro-txt"><Icone nome="alerta" tam={18} /> Não foi possível salvar</span>
        : <span className="ok-txt"><Icone nome="check" tam={18} /> Alterações salvas</span>
  const salvarBotao = (s === 'texto' || s === 'producao' || s === 'final') && (
    <button className="btn btn-contorno" disabled={estado === 'salvo' || estado === 'salvando'} onClick={salvar}>{aba === 'visual' ? `Salvar ${cfg.abas.find((a) => a.id === 'visual')?.nome.toLowerCase()}` : 'Salvar rascunho'}</button>
  )
  const material = infoFormato(peca.tipo).material.toLowerCase()

  if (s === 'texto') return (
    <Rodape esquerda={esquerda} nota={cfg.etapa2 ? `A aprovação do ${material} não aprova a ${cfg.etapa2.nome.toLowerCase()} nem publica a peça.` : `Aprovar o ${material} não publica a peça.`}>
      {salvarBotao}<button className="btn btn-ouro" disabled={!!bloqueio} title={bloqueio} onClick={acoes.aprovarTexto}><Icone nome="check" tam={16} /> Aprovar {material}</button>
    </Rodape>
  )
  if (s === 'producao' && cfg.etapa2) {
    const total = cfg.artes === 'por_item' ? r.itens.length : 1
    const faltam = cfg.etapa2.arquivos ? Array.from({ length: total }, (_, j) => r.artes[j]?.arquivo).filter((x) => !x).length : 0
    return (
      <Rodape esquerda={esquerda} nota={faltam ? `${cfg.etapa2.acao} fica disponível depois de enviar ${faltam === 1 ? 'o arquivo que falta' : `os ${faltam} arquivos que faltam`}.` : undefined}>
        {salvarBotao}
        {faltam > 0 && !fora && <button className="link pequeno" onClick={() => setFora(true)}>Foi feita fora do sistema?</button>}
        {faltam > 0 && fora && <button className="btn btn-contorno-ouro" disabled={!!bloqueio} onClick={acoes.concluirProducao}>Confirmar: {cfg.etapa2.feita.toLowerCase()} fora do sistema</button>}
        <button className="btn btn-ouro" disabled={!!bloqueio || faltam > 0} title={bloqueio} onClick={acoes.concluirProducao}><Icone nome="check" tam={16} /> {cfg.etapa2.acao}</button>
      </Rodape>
    )
  }
  if (s === 'final') return (
    <Rodape esquerda={esquerda} nota="Aprovar a peça não publica: depois de postar, marque como publicada.">
      {salvarBotao}<button className="btn btn-ouro" disabled={!!bloqueio} title={bloqueio} onClick={acoes.aprovarPeca}><Icone nome="check" tam={16} /> Aprovar peça</button>
    </Rodape>
  )
  if (s === 'pronto') return (
    <Rodape esquerda={esquerda} nota="Peça aprovada. Depois de postar no canal, marque como publicada.">
      <button className="btn btn-ouro" onClick={acoes.publicar}><Icone nome="enviar" tam={16} /> Marcar como publicada</button>
    </Rodape>
  )
  return <Rodape esquerda={esquerda} nota="Peça publicada." />
}
