// CRM — NÚCLEO: coluna da esquerda da caixa de conversas (abas, busca, filtros e a lista).
import { Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { telefoneLegivel } from '../nucleo'
import { horaCurta, type BaseCRM, type Conversa } from '../tipos'
import { Avatar, interesseDe } from '../Pecas'
import { aguardandoResposta } from './util'

export type Aba = 'minhas' | 'fila' | 'todas' | 'resolvidas'
export type Filtros = { busca: string; canal: string; naoLidas: boolean; aguardando: boolean }

type Props = {
  base: BaseCRM; convs: Conversa[]; lista: Conversa[]; aba: Aba; setAba: (a: Aba) => void; doAba: (c: Conversa, a: Aba) => boolean
  f: Filtros; setF: (f: Filtros) => void; achados: Map<string, string | null> | null; sel: string | null; abrir: (id: string) => void
  erro: string | null; aoSimular: (() => void) | null
}

export function ListaConversas({ base, convs, lista, aba, setAba, doAba, f, setF, achados, sel, abrir, erro, aoSimular }: Props) {
  const conta = (a: Aba) => convs.filter((c) => doAba(c, a)).length
  const naAba = convs.filter((c) => doAba(c, aba))
  const naoLidas = naAba.filter((c) => c.nao_lidas > 0).length
  const aguardando = naAba.filter(aguardandoResposta).length
  const abas: [Aba, string][] = [['minhas', 'Minhas'], ['fila', 'Fila'], ...(base.souAdmin ? [['todas', 'Todas'] as [Aba, string]] : []), ['resolvidas', 'Resolvidas']]
  const ativos = base.canais.filter((k) => k.ativo)
  return (
    <aside className="caixa-lista">
      <div className="caixa-lista-topo">
        <div className="cl-titulo"><h2>Conversas</h2>{aoSimular && <button className="btn btn-mini" onClick={aoSimular} title="Faz de conta que alguém escreveu para o número de teste">Simular</button>}</div>
        <div className="abas-mini">
          {abas.map(([k, r]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>{r} <span className={convs.some((c) => doAba(c, k) && c.nao_lidas > 0) ? 'bolinha' : ''}>{conta(k)}</span></button>)}
        </div>
        <label className="select-icone"><Icone nome="busca" tam={16} /><input placeholder="Buscar nome, número ou palavra da conversa" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} /></label>
        {ativos.length > 1 && (
          <label className="cl-numero"><span className="muted">Número:</span>
            <select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })} aria-label="Número"><option value="">Todos</option>{ativos.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}</select>
          </label>
        )}
        <div className="cl-chips">
          <button className={f.naoLidas ? 'ativo' : ''} onClick={() => setF({ ...f, naoLidas: !f.naoLidas })}>Não lidas <span>{naoLidas}</span></button>
          <button className={f.aguardando ? 'ativo' : ''} onClick={() => setF({ ...f, aguardando: !f.aguardando })} title="A pessoa escreveu por último e ainda não teve resposta">Aguardando resposta <span>{aguardando}</span></button>
        </div>
      </div>
      <Erro msg={erro} />
      <div className="caixa-itens">
        {lista.length === 0
          ? <Vazio>{aba === 'fila' ? 'Ninguém esperando na fila.' : aba === 'minhas' ? 'Nenhuma conversa com você. Pegue uma da fila.' : 'Nada aqui.'}</Vazio>
          : lista.map((c) => <ItemConversa key={c.id} c={c} base={base} sel={c.id === sel} achado={achados?.get(c.id) ?? null} aoAbrir={() => abrir(c.id)} />)}
      </div>
    </aside>
  )
}

function ItemConversa({ c, base, sel, achado, aoAbrir }: { c: Conversa; base: BaseCRM; sel: boolean; achado: string | null; aoAbrir: () => void }) {
  const interesse = interesseDe(c.contato?.tags, c.contato?.origem)
  const canal = base.canais.length > 1 ? base.canais.find((k) => k.id === c.canal_id)?.nome : null
  const quem = c.com_ia ? 'IA atendendo' : c.atendente_id ? base.nomeDe(c.atendente_id) : 'Na fila'
  return (
    <button className={`caixa-item${sel ? ' sel' : ''}${c.nao_lidas ? ' nova' : ''}`} onClick={aoAbrir}>
      <Avatar nome={c.contato?.nome || c.contato?.telefone} />
      <span className="ci-corpo">
        <span className="ci-linha"><b>{c.contato?.nome || telefoneLegivel(c.contato?.telefone)}</b><span className="muted pequeno">{horaCurta(c.ultima_em)}</span></span>
        <span className="ci-linha">
          <span className="ci-msg">{achado ? <mark className="ci-achado">{achado}</mark> : <>{c.ultima_direcao === 'saida' ? '✓ ' : ''}{c.ultima_mensagem ?? ''}</>}</span>
          {c.nao_lidas > 0 && <span className="ci-nao-lidas">{c.nao_lidas}</span>}
        </span>
        <span className="ci-chips">
          <span className={`ci-chip${c.com_ia ? ' ia' : ''}`}>{quem}</span>
          {interesse && <span className="ci-chip ouro">{interesse}</span>}
          {canal && <span className="ci-chip apagado">{canal}</span>}
        </span>
      </span>
    </button>
  )
}
