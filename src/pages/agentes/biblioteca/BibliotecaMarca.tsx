// Base da marca → Biblioteca: os materiais da própria empresa (apostilas, aulas, protocolos, textos). Cada um vira
// trechos pesquisáveis; antes de escrever, o agente busca os trechos do assunto, só nos materiais aprovados.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { tirarFonte, useFontes, type Fonte } from './dados'
import { ColarTexto, EnviarArquivos } from './EnviarMaterial'
import { RevisarFonte } from './RevisarFonte'

const ICONE: Record<string, string> = { pdf: 'pdf', docx: 'documento', texto: 'texto', tutor: 'mensagem', video: 'video', post: 'imagem', link: 'globo' }
const NOME_TIPO: Record<string, string> = { pdf: 'PDF', docx: 'Word', texto: 'Texto', tutor: 'Conversa com o tutor', video: 'Vídeo transcrito', post: 'Post', link: 'Página' }
type Filtro = 'todos' | 'aprovados' | 'validar'

function ItemFonte({ empresa, f, aoMudou }: { empresa: string; f: Fonte; aoMudou: () => void }) {
  const [revisando, setRevisando] = useState(false)
  const [tirar, setTirar] = useState(false)
  const detalhe = f.status === 'pronta' ? `${f.trechos} trechos` : f.status === 'erro' ? `Erro: ${f.erro ?? ''}` : 'Guardando…'
  return (
    <li className={`bib-fonte${f.aprovada ? '' : ' validar'}`}>
      <div className="bib-fonte-linha">
        <span className="bib-fonte-ico"><Icone nome={ICONE[f.tipo] ?? 'arquivo'} tam={18} /></span>
        <span className="bib-fonte-txt"><b>{f.titulo}</b><small>{NOME_TIPO[f.tipo] ?? f.tipo} · {detalhe} · {new Date(f.criado_em).toLocaleDateString('pt-BR')}</small></span>
        <span className={`badge ${f.aprovada ? 'badge-ok' : 'badge-alerta'}`}>{f.aprovada ? 'Aprovado' : 'A validar'}</span>
        <span className="ia-linha">
          {f.status === 'pronta' && <button type="button" className="btn btn-contorno-ouro btn-mini" onClick={() => setRevisando(!revisando)}><Icone nome="lapis" tam={13} /> Revisar</button>}
          {tirar ? <><button type="button" className="btn btn-mini" onClick={async () => { await tirarFonte(f.id); aoMudou() }}>Sim, tirar</button><button type="button" className="btn btn-mini" onClick={() => setTirar(false)}>Não</button></>
            : <button type="button" className="btn btn-mini" onClick={() => setTirar(true)} title="Tirar da biblioteca" aria-label={`Tirar ${f.titulo}`}><Icone nome="lixeira" tam={13} /></button>}
        </span>
      </div>
      {!f.aprovada && !revisando && <p className="bib-aviso pequeno"><Icone nome="alerta" tam={14} /> Este material ainda não é usado como fonte pelos agentes.</p>}
      {revisando && <RevisarFonte empresa={empresa} f={f} aoTerminar={aoMudou} aoFechar={() => setRevisando(false)} />}
    </li>
  )
}

export function BibliotecaMarca({ empresa }: { empresa: string }) {
  const fontes = useFontes(empresa)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [colando, setColando] = useState(false)
  const lista = fontes.dados ?? []
  const termo = busca.trim().toLowerCase()
  const conta = { todos: lista.length, aprovados: lista.filter((f) => f.aprovada).length, validar: lista.filter((f) => !f.aprovada).length }
  const visiveis = lista.filter((f) => (filtro === 'todos' || (filtro === 'aprovados') === f.aprovada) && (!termo || f.titulo.toLowerCase().includes(termo)))
  return (
    <section className="bm-cartao bib">
      <div className="camp-cab">
        <div><h2>Biblioteca da marca</h2><p className="muted pequeno">Os materiais da própria empresa: cursos, técnicas, protocolos, perguntas frequentes.</p></div>
        <div className="ia-linha"><EnviarArquivos empresa={empresa} aoTerminar={fontes.recarregar} />
          <button type="button" className="btn btn-contorno-ouro" onClick={() => setColando(!colando)}><Icone nome="texto" tam={16} /> Adicionar texto</button></div>
      </div>
      {colando && <ColarTexto empresa={empresa} aoTerminar={fontes.recarregar} aoFechar={() => setColando(false)} />}
      <span className="muted pequeno">Aceita PDF (com texto selecionável), Word (.docx) e texto. Pode enviar vários de uma vez.</span>
      {lista.length > 0 && <>
        <label className="camp-busca bib-filtro"><Icone nome="busca" tam={16} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por tema, produto ou documento…" /></label>
        <div className="ia-linha">{([['todos', 'Todos'], ['aprovados', 'Aprovados'], ['validar', 'A validar']] as [Filtro, string][]).map(([id, nome]) => (
          <button key={id} type="button" className={`mk-chip${filtro === id ? ' ativo' : ''}`} onClick={() => setFiltro(id)}>{nome} ({conta[id]})</button>))}</div>
        <ul className="bib-fontes">{visiveis.map((f) => <ItemFonte key={f.id} empresa={empresa} f={f} aoMudou={fontes.recarregar} />)}</ul>
        {!visiveis.length && <p className="muted pequeno">Nenhum material neste filtro.</p>}
      </>}
      {!lista.length && !fontes.carregando && <p className="muted pequeno">A biblioteca está vazia. Envie apostilas, roteiros de aula ou protocolos: o agente passa a escrever com o que a marca ensina, sem inventar.</p>}
      <Erro msg={fontes.erro} />
    </section>
  )
}
