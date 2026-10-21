// Agente Editor de Vídeo, em três abas: Vídeos (arrastar um vídeo para editar e a lista do que está em edição),
// Estilo da casa e Banco de imagens. A edição em si acontece na peça (aba "Edição do vídeo"), onde estão o roteiro e a
// legenda. Sem o agente contratado, a página apresenta o editor e leva para ligar o agente.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BotaoAjuda } from './ajuda/BotaoAjuda'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Erro, Vazio } from '../../components/ui'
import { Voltar } from '../../components/Voltar'
import { Retrato } from './Retrato'
import { visualDe, type Peca } from './comum'
import { EMPRESA } from './marketing/useMarketing'
import { edicaoDa, useTemEditor } from './marketing/edicao/dados'
import { useLogos } from './LogosMarca'
import { BancoImagens, bancoDe } from './BancoImagens'
import { NovoVideo } from './editor/NovoVideo'
import { EstiloCasa } from './editor/EstiloCasa'
import { EstilosReferencia } from './editor/EstilosReferencia'
import { usePerfilEditor } from './editor/dados'

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'Sem data')

function situacao(p: Peca) {
  const e = edicaoDa(p.conteudo)
  if (e.receitas?.length) return { txt: `Editado · ${e.receitas.length} versão(ões)`, tom: 'ok' }
  if (e.palavras?.length) return { txt: 'Transcrito', tom: 'alerta' }
  return { txt: 'Aguardando o vídeo', tom: 'neutro' }
}

type Aba = 'videos' | 'estilo' | 'banco'

export default function AgenteEditor() {
  const [params] = useSearchParams()
  const [aba, setAba] = useState<Aba>(() => { const a = params.get('aba'); return a === 'estilo' || a === 'banco' ? a : 'videos' })
  const a = visualDe('editor')
  const tem = useTemEditor()
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing')
    .in('tipo', ['reels', 'video']).neq('status', 'descartada').order('dia', { ascending: false }).limit(60))
  const lista = (pecas.dados ?? []).filter((p) => p.conteudo.etapa !== 'ideia')
  const marca = useLogos(EMPRESA)
  const perfilMarca = marca.dados?.perfil ?? {}
  const campanhas = ((Array.isArray(perfilMarca.campanhas) ? perfilMarca.campanhas : []) as { id: string; nome: string; encerrada?: boolean }[]).filter((c) => !c.encerrada)
  const editor = usePerfilEditor()

  return (
    <div className="pagina">
      <div className="migalha"><Voltar para="/agentes" texto="Sala dos agentes" /></div>
      <header className="agente-topo" style={{ ['--cor-agente' as string]: a.cor }}>
        <Retrato agente="editor" estado={tem.dados ? 'trabalhando' : 'parado'} alto={150} />
        <div>
          <h1>Agente {a.nome} <BotaoAjuda id={aba === 'videos' ? 'editar-video' : 'estilo-casa'} /></h1>
          <p className="agente-papel">{a.papel} · Academy e Clinical</p>
          <p>{a.descricao}</p>
          {tem.dados === false && <p className="nota">Este agente é contratado à parte e ainda não está ligado na empresa. Ligue em <Link to="/agentes/central?aba=agentes" className="link">Configurações → Agentes</Link>.</p>}
        </div>
      </header>
      {tem.dados && (
        <div className="abas">
          <button type="button" className={aba === 'videos' ? 'ativa' : ''} onClick={() => setAba('videos')}>Vídeos</button>
          <button type="button" className={aba === 'estilo' ? 'ativa' : ''} onClick={() => setAba('estilo')}>Estilo da casa</button>
          <button type="button" className={aba === 'banco' ? 'ativa' : ''} onClick={() => setAba('banco')}>Banco de imagens · {bancoDe(perfilMarca).length}</button>
        </div>
      )}
      {/* fica montado ao trocar de aba: o vídeo e o roteiro escolhidos não somem */}
      {tem.dados && <section className="bloco" hidden={aba !== 'videos'}><NovoVideo campanhas={campanhas} /></section>}
      {tem.dados && aba === 'videos' && (
        <section className="bloco">
          <h2>Em edição</h2>
          <p className="muted pequeno">Os reels e vídeos roteirizados pelo Agente de Marketing e os que você trouxe aqui. Clique em Abrir para continuar a edição.</p>
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
                    <td><Link className="btn btn-mini" to={`/agentes/marketing?peca=${p.id}&edicao=1`}>Abrir</Link></td>
                  </tr>
                )
              })}</tbody>
            </table>
          )}
        </section>
      )}
      {tem.dados && aba === 'estilo' && (
        <section className="bloco">
          <h2>Estilo da casa</h2>
          <EstiloCasa perfil={editor.dados?.perfil} aoSalvar={editor.recarregar} />
        </section>
      )}
      {tem.dados && aba === 'estilo' && <EstilosReferencia />}
      {tem.dados && marca.dados && aba === 'banco' && (
        <section className="bloco">
          <h2>Banco de imagens</h2>
          <BancoImagens empresaId={EMPRESA} perfil={perfilMarca} aoSalvar={marca.recarregar} />
        </section>
      )}
    </div>
  )
}
