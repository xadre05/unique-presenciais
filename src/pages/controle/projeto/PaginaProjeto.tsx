// Controle → Projeto do ecossistema: fases e épicos, o quadro da semana, os épicos com a lista de espera e a caixa de ideias.
// Só o administrador vê. Claude atualiza as entregas e tarefas conforme trabalha; você testa, aprova e tria as ideias.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Erro, Vazio } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { useProjeto, type Entrega } from './dados'
import { VisaoGeral } from './VisaoGeral'
import { QuadroSemana } from './QuadroSemana'
import { Epicos } from './Epicos'
import { Ideias } from './Ideias'
import { DetalheEntrega } from './DetalheEntrega'

const ABAS = [['geral', 'Visão geral', 'grafico'], ['semana', 'Semana', 'quadro'], ['epicos', 'Épicos', 'lista'], ['ideias', 'Caixa de ideias', 'ideia']] as const

export default function PaginaProjeto() {
  const uso = useProjeto()
  const [params, setParams] = useSearchParams()
  const [aberta, setAberta] = useState<string | null>(null)
  const aba = params.get('aba') ?? 'geral'
  const irPara = (a: string, extra: Record<string, string> = {}) => setParams({ aba: a, ...extra })
  const novas = uso.dados?.ideias.filter((i) => i.status === 'nova').length ?? 0
  // a entrega é relida da lista a cada gravação, para o detalhe aberto mostrar o estado atual
  const entrega = uso.dados?.entregas.find((e) => e.id === aberta) ?? null
  const abrir = (e: Entrega) => setAberta(e.id)

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Projeto do ecossistema</h1>
        <p className="muted">Fases e épicos do ecossistema, o que está sendo feito nesta semana e a caixa de ideias. Ideia nova entra na caixa; o que entra na semana é escolhido no domingo.</p></div></header>
      <nav className="abas">
        {ABAS.map(([id, rotulo, icone]) => (
          <button key={id} className={aba === id ? 'ativa' : ''} onClick={() => irPara(id)}><Icone nome={icone} tam={16} /> {rotulo}{id === 'ideias' && novas > 0 && <span className="prj-conta">{novas}</span>}</button>
        ))}
      </nav>
      <Erro msg={uso.erro} />
      {!uso.dados ? (!uso.erro && <Vazio>Carregando o projeto…</Vazio>) : (
        <>
          {aba === 'geral' && <VisaoGeral uso={uso} irPara={irPara} abrirEpico={(id) => irPara('epicos', { epico: id })} />}
          {aba === 'semana' && <QuadroSemana uso={uso} abrir={abrir} />}
          {aba === 'epicos' && <Epicos uso={uso} selecionado={params.get('epico')} selecionar={(id) => irPara('epicos', { epico: id })} abrir={abrir} />}
          {aba === 'ideias' && <Ideias uso={uso} />}
        </>
      )}
      {entrega && <DetalheEntrega key={entrega.id + entrega.status} entrega={entrega} uso={uso} aoFechar={() => setAberta(null)} />}
    </div>
  )
}
