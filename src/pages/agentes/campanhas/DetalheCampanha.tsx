// Detalhe de uma campanha: objetivo, período, o que vende (com o preço do produto), oferta, comunicação, mensagem,
// materiais e os conteúdos ligados a ela (planejamentos e peças), com atalho para vê-los no Agente de Marketing.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { ETAPAS, etapaDe } from '../marketing/etapas'
import { precoDe, textoSituacao, type Produto } from '../marca/dados'
import { NOME_SITUACAO, TOM_SITUACAO, dataBR, periodoCampanha, situacaoCampanha, type CampanhaGuardada } from './dados'

type Props = { empresa: string; c: CampanhaGuardada; produtos: Produto[]; aoEditar: () => void; aoEncerrar: (encerrada: boolean) => void }

function Item({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div className="camp-item"><b>{titulo}</b><div>{children}</div></div>
}

// mensagem longa abre recolhida (as primeiras linhas) para o detalhe não virar uma página sem fim
function TextoLongo({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false)
  const longo = texto.length > 600
  return (<>
    <p className={`camp-texto${longo && !aberto ? ' recolhido' : ''}`}>{texto}</p>
    {longo && <button type="button" className="link camp-mais" onClick={() => setAberto(!aberto)}>{aberto ? 'Mostrar menos' : 'Ver mensagem completa'}</button>}
  </>)
}

function ConteudosVinculados({ empresa, c }: { empresa: string; c: CampanhaGuardada }) {
  const pecas = useConsulta<Pick<Peca, 'id' | 'status' | 'tipo' | 'conteudo'>[]>(() => supabase.from('agentes_pecas').select('id,status,tipo,conteudo')
    .eq('empresa_id', empresa).eq('agente_id', 'marketing').eq('conteudo->>campanha', c.id).neq('status', 'descartada').limit(500), [c.id])
  const lista = (pecas.dados ?? []).filter((p) => !p.conteudo.proposta)
  const planos = new Set(lista.map((p) => p.conteudo.plano).filter(Boolean)).size
  const porEtapa = ETAPAS.map((e) => ({ ...e, n: lista.filter((p) => etapaDe(p as Peca) === e.id).length })).filter((e) => e.n)
  return (
    <section className="camp-detalhe camp-vinculos">
      <div className="camp-cab">
        <div><h3 className="camp-titulo">Conteúdos vinculados</h3><p className="muted pequeno">Os planejamentos e as peças desta campanha.</p></div>
        <div className="ia-linha">
          <Link className="btn btn-contorno-ouro btn-mini" to={`/agentes/marketing?campanha=${c.id}${c.inicio ? `&data=${c.inicio}` : ''}`}><Icone nome="agenda" tam={14} /> Ver no calendário</Link>
          <Link className="btn btn-contorno-ouro btn-mini" to={`/agentes/marketing?aba=producao&campanha=${c.id}`}><Icone nome="imagem" tam={14} /> Ver peças</Link>
        </div>
      </div>
      {pecas.carregando && !pecas.dados ? <p className="muted pequeno">Carregando…</p>
        : lista.length ? (
          <p className="camp-contas">
            <span><b>{lista.length}</b> peça(s)</span><span><b>{planos}</b> planejamento(s)</span>
            {porEtapa.map((e) => <span key={e.id} style={{ color: e.cor }}>{e.n} {e.nome.toLowerCase()}</span>)}
          </p>)
        : <p className="muted pequeno">Nenhuma peça desta campanha ainda. Em Planejar conteúdo, escolha esta campanha.</p>}
      <p className="nota pequeno"><Icone nome="info" tam={14} /> Depois do encerramento, a campanha deixa de ser sugerida para conteúdos novos; o histórico fica.</p>
    </section>
  )
}

export function DetalheCampanha({ empresa, c, produtos, aoEditar, aoEncerrar }: Props) {
  const s = situacaoCampanha(c)
  const vende = (c.produtos ?? []).map((id) => produtos.find((p) => p.id === id)).filter(Boolean) as Produto[]
  return (<>
    <section className="camp-detalhe">
      <div className="camp-cab">
        <div><h3 className="camp-titulo grande">{c.nome}</h3><span className={`badge ${TOM_SITUACAO[s]}`}>{NOME_SITUACAO[s]}</span></div>
        <div className="ia-linha">
          <button type="button" className="btn btn-contorno-ouro" onClick={aoEditar}><Icone nome="lapis" tam={15} /> Editar campanha</button>
          <button type="button" className="btn" onClick={() => aoEncerrar(!c.encerrada)}>{c.encerrada ? 'Reabrir' : 'Encerrar agora'}</button>
        </div>
      </div>
      <div className="camp-duas">
        <Item titulo="Objetivo">{c.objetivo || <span className="muted">Não informado</span>}</Item>
        <Item titulo="Período">{periodoCampanha(c)}{c.fim && <small className="muted bloco-linha">Encerramento {dataBR(c.fim).slice(0, 5)} às {c.hora_fim ?? '23:59'} · Brasília</small>}</Item>
      </div>
      <Item titulo="O que vende">
        {vende.length ? <ul className="camp-vende">{vende.map((p) => <li key={p.id}><b>{p.nome}</b><small className="muted">{[precoDe(p), textoSituacao(p)].filter(Boolean).join(' · ')}</small></li>)}</ul>
          : <span className="muted">Nenhum produto: campanha de marca, seguidores ou relacionamento.</span>}
      </Item>
      {c.oferta && <Item titulo="Oferta da campanha">{c.oferta}</Item>}
      {c.comunicacao && <Item titulo="Nome e comunicação">{c.comunicacao}</Item>}
      {c.descricao && <Item titulo="Mensagem, fases e regras"><TextoLongo texto={c.descricao} /></Item>}
      <Item titulo="Materiais e condições">
        {c.link ? <a className="link" href={c.link} target="_blank" rel="noreferrer"><Icone nome="links" tam={14} /> Consultar materiais da campanha</a> : <span className="muted">Sem link de materiais.</span>}
        <small className="muted bloco-linha">Preço e pagamento vêm dos produtos ligados (A marca → Produtos e condições).</small>
      </Item>
    </section>
    <ConteudosVinculados empresa={empresa} c={c} />
  </>)
}
