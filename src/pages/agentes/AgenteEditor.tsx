// Agente Editor de Vídeo: os vídeos para editar (reels e vídeos das peças do Marketing) e em que pé está cada edição.
// A edição em si acontece na peça (aba "Edição do vídeo"), onde estão o roteiro e a legenda. Sem o agente contratado,
// a página apresenta o editor e leva para ligar o agente.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Erro, Vazio } from '../../components/ui'
import { Voltar } from '../../components/Voltar'
import { Retrato } from './Retrato'
import { visualDe, type Peca } from './comum'
import { EMPRESA } from './marketing/useMarketing'
import { edicaoDa, useTemEditor } from './marketing/edicao/dados'

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'Sem data')

function situacao(p: Peca) {
  const e = edicaoDa(p.conteudo)
  if (e.receitas?.length) return { txt: `Editado · ${e.receitas.length} versão(ões)`, tom: 'ok' }
  if (e.palavras?.length) return { txt: 'Transcrito', tom: 'alerta' }
  return { txt: 'Aguardando o vídeo', tom: 'neutro' }
}

export default function AgenteEditor() {
  const a = visualDe('editor')
  const tem = useTemEditor()
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing')
    .in('tipo', ['reels', 'video']).neq('status', 'descartada').order('dia', { ascending: false }).limit(60))
  const lista = (pecas.dados ?? []).filter((p) => p.conteudo.etapa !== 'ideia')

  return (
    <div className="pagina">
      <div className="migalha"><Voltar para="/agentes" texto="Sala dos agentes" /></div>
      <header className="agente-topo" style={{ ['--cor-agente' as string]: a.cor }}>
        <Retrato agente="editor" estado={tem.dados ? 'trabalhando' : 'parado'} alto={260} />
        <div>
          <h1>Agente {a.nome}</h1>
          <p className="agente-papel">{a.papel} · Academy e Clinical</p>
          <p>{a.descricao}</p>
          {tem.dados === false && <p className="nota">Este agente é contratado à parte e ainda não está ligado na empresa. Ligue em <Link to="/agentes/central?aba=agentes" className="link">Configurações → Agentes</Link>.</p>}
        </div>
      </header>
      {tem.dados && (
        <section className="bloco">
          <h2>Vídeos para editar</h2>
          <p className="muted pequeno">Os reels e vídeos que o Agente de Marketing roteirizou. Abra um, escolha o vídeo gravado e o editor faz o resto. Para editar um vídeo novo, crie a peça de reels no Marketing primeiro: é de lá que vêm o roteiro e a legenda.</p>
          <Erro msg={pecas.erro} />
          {pecas.carregando && !pecas.dados ? <p className="muted">Carregando…</p> : !lista.length ? <Vazio>Nenhum reels ou vídeo roteirizado ainda.</Vazio> : (
            <table className="tabela">
              <thead><tr><th>Peça</th><th>Formato</th><th>Data</th><th>Edição</th><th /></tr></thead>
              <tbody>{lista.map((p) => {
                const s = situacao(p)
                return (
                  <tr key={p.id}>
                    <td>{p.titulo}</td><td>{p.tipo === 'video' ? 'Vídeo longo' : 'Reels'}</td><td>{dataBr(p.dia)}</td>
                    <td><span className={`sala-pilula tom-${s.tom}`}>{s.txt}</span></td>
                    <td><Link className="btn btn-mini" to={`/agentes/marketing?peca=${p.id}&edicao=1`}>Editar</Link></td>
                  </tr>
                )
              })}</tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
