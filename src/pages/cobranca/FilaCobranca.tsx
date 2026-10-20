// Fila de cobrança (Comercial, ao lado de Pagamentos): todo mundo que deve, online e presencial, já na fila. A cobradora vê só o que
// foi passado para ela; o administrador vê tudo, filtra e distribui em lote. Abas por etapa, mais antigas primeiro.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { useAuth } from '../../auth'
import { brl, hojeISO } from '../../lib/format'
import { Erro, Kpi, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { aberta, distribuir, nomeCurtoConta, useCobrancas, useContasHotmart } from './dados'
import { ABAS, IDADES, naAba, ordenar, passaFiltro, somaRestante, somaVencido, type Aba, type Filtro, type Ordem } from './filtros'
import { CartaoCobranca } from './CartaoCobranca'
import { RecebimentosCobranca } from './RecebimentosCobranca'
import { PainelNotificacao } from './notificacao/PainelNotificacao'

const POR_VEZ = 40

function BarraDistribuir({ qtd, vendedoras, aoPassar, aoLimpar }: { qtd: number; vendedoras: { id: string; nome: string }[]; aoPassar: (v: string | null) => void; aoLimpar: () => void }) {
  return (
    <div className="cob-lote">
      <b>{qtd} selecionada(s)</b>
      <label className="select-icone"><Icone nome="usuario" tam={16} /><select value="" onChange={(e) => e.target.value && aoPassar(e.target.value === '-' ? null : e.target.value)} aria-label="Passar para">
        <option value="">Passar para…</option>{vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}<option value="-">Tirar de quem está</option></select></label>
      <button type="button" className="btn btn-mini" onClick={aoLimpar}>Limpar seleção</button>
    </div>
  )
}

export default function FilaCobranca() {
  const { perfil, isAdmin } = useAuth()
  const cobrancas = useCobrancas(), contas = useContasHotmart()
  const vendedoras = useConsulta<{ id: string; nome: string }[]>(() => supabase.from('vendedoras').select('id,nome').eq('ativa', true).order('nome'), [])
  const [qs] = useSearchParams()
  const [tela, setTela] = useState<'fila' | 'notificacao' | 'recebimentos'>('fila')
  const [aba, setAba] = useState<Aba>(qs.get('busca') ? 'todas' : 'a_contatar')
  const [ordem, setOrdem] = useState<Ordem>('antigas')
  const [f, setF] = useState<Filtro>({ origem: '', conta: '', idade: '', quem: '', busca: qs.get('busca') ?? '' })
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [qtd, setQtd] = useState(POR_VEZ)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = hojeISO(), eu = perfil?.nome || perfil?.email || 'Equipe'
  const nomeConta = (id: string | null) => nomeCurtoConta((contas.dados ?? []).find((x) => x.id === id)?.nome ?? '')
  const nomeVend = (id: string | null) => (vendedoras.dados ?? []).find((v) => v.id === id)?.nome ?? null

  // encerradas pelo sistema sem ninguém ter trabalhado (não eram dívida) não poluem a fila
  const todas = useMemo(() => (cobrancas.dados ?? []).filter((c) => aberta(c) || c.tentativas > 0 || c.responsavel_id || c.etapa === 'paga'), [cobrancas.dados])
  const doFiltro = useMemo(() => todas.filter((c) => passaFiltro(c, f)), [todas, f])
  const visiveis = useMemo(() => ordenar(doFiltro.filter((c) => naAba(c, aba, hoje)), ordem), [doFiltro, aba, ordem, hoje])
  const abertas = doFiltro.filter(aberta)
  const emAcordo = abertas.filter((c) => c.etapa === 'acordo')
  const conta = (a: Aba) => doFiltro.filter((c) => naAba(c, a, hoje)).length
  const mudarF = (p: Partial<Filtro>) => { setF({ ...f, ...p }); setQtd(POR_VEZ); setMarcadas(new Set()) }
  const marcar = (id: string, v: boolean) => { const s = new Set(marcadas); if (v) s.add(id); else s.delete(id); setMarcadas(s) }
  const passar = async (vend: string | null) => {
    setErro(null)
    try { await distribuir([...marcadas], vend); setMarcadas(new Set()); cobrancas.recarregar() } catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Cobranças</h1>
        <p className="muted">{isAdmin ? 'Todo mundo que deve, do online (Hotmart) e do presencial. A fila se atualiza sozinha de hora em hora e tira quem voltou a pagar.' : 'Quem você precisa cobrar. Quando a pessoa paga, sai da fila sozinha.'}</p></div>
        {isAdmin && <div className="re-abas" role="tablist">
          <button type="button" role="tab" aria-selected={tela === 'fila'} className={tela === 'fila' ? 'ativa' : ''} onClick={() => setTela('fila')}>Fila</button>
          <button type="button" role="tab" aria-selected={tela === 'notificacao'} className={tela === 'notificacao' ? 'ativa' : ''} onClick={() => setTela('notificacao')}>Notificação extrajudicial</button>
          <button type="button" role="tab" aria-selected={tela === 'recebimentos'} className={tela === 'recebimentos' ? 'ativa' : ''} onClick={() => setTela('recebimentos')}>Recebimentos e comissão</button>
        </div>}
      </header>

      {tela === 'notificacao' ? <PainelNotificacao lista={todas} nomeConta={nomeConta} aoMudar={cobrancas.recarregar} eu={eu} /> : tela === 'recebimentos' ? <RecebimentosCobranca cobrancas={cobrancas.dados ?? []} nomeVend={nomeVend} aoMudar={cobrancas.recarregar} /> : (<>
        <section className="kpis at-kpis-4">
          <Kpi rotulo="Dívida total" valor={brl(somaRestante(abertas))} tom="erro" sub={`${new Set(abertas.map((c) => c.email ?? c.chave)).size} pessoas · tudo o que falta pagar do contrato`} />
          <Kpi rotulo="Já venceu" valor={brl(somaVencido(abertas))} sub="parte da dívida com a data já passada" />
          <Kpi rotulo="Ainda vai vencer" valor={brl(somaRestante(abertas) - somaVencido(abertas))} sub="parte da dívida com data no futuro" />
          <Kpi rotulo="Em acordo" valor={brl(emAcordo.reduce((s, c) => s + Number(c.acordo_valor ?? 0), 0))} tom="ok" sub={`${emAcordo.length} acordo(s)`} />
        </section>

        <nav className="abas">{ABAS.map(([k, r]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => { setAba(k); setQtd(POR_VEZ) }}>{r} <span className="muted">{conta(k)}</span></button>)}</nav>
        <div className="filtros-lista cob-filtros">
          <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar nome, e-mail, telefone ou produto" value={f.busca} onChange={(e) => mudarF({ busca: e.target.value })} /></label>
          <label className="select-icone"><select value={f.origem} onChange={(e) => mudarF({ origem: e.target.value as Filtro['origem'] })} aria-label="Origem"><option value="">Online e presencial</option><option value="online">Só online</option><option value="presencial">Só presencial</option></select></label>
          <label className="select-icone"><Icone nome="links" /><select value={f.conta} onChange={(e) => mudarF({ conta: e.target.value })} aria-label="Conta da Hotmart"><option value="">Todas as contas</option>{(contas.dados ?? []).map((c) => <option key={c.id} value={c.id}>{nomeCurtoConta(c.nome)}</option>)}</select></label>
          <label className="select-icone"><Icone nome="relogio" /><select value={f.idade} onChange={(e) => mudarF({ idade: e.target.value as Filtro['idade'] })} aria-label="Há quanto tempo parou">{IDADES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
          {isAdmin && <label className="select-icone"><Icone nome="usuario" tam={16} /><select value={f.quem} onChange={(e) => mudarF({ quem: e.target.value })} aria-label="Responsável"><option value="">Qualquer responsável</option><option value="ninguem">Sem responsável</option>{(vendedoras.dados ?? []).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
          <label className="select-icone"><Icone nome="filtro" /><select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordem"><option value="antigas">Mais antigas primeiro</option><option value="valor">Maior valor primeiro</option><option value="recentes">Mais recentes primeiro</option></select></label>
        </div>
        {isAdmin && visiveis.length > 0 && <div className="cob-selecao">
          <label className="check"><input type="checkbox" checked={visiveis.every((c) => marcadas.has(c.id))} onChange={(e) => setMarcadas(e.target.checked ? new Set(visiveis.map((c) => c.id)) : new Set())} /> Selecionar as {visiveis.length} desta aba e filtro</label>
          {marcadas.size > 0 && <BarraDistribuir qtd={marcadas.size} vendedoras={vendedoras.dados ?? []} aoPassar={passar} aoLimpar={() => setMarcadas(new Set())} />}
        </div>}
        <Erro msg={erro || cobrancas.erro} />
        {!cobrancas.carregando && !visiveis.length ? <Vazio>{aba === 'a_contatar' ? (isAdmin ? 'Ninguém para contatar com esses filtros.' : 'Nenhuma cobrança passada para você nesta etapa.') : 'Nada nesta aba.'}</Vazio> : (
          <div className="itens-lista">
            {visiveis.slice(0, qtd).map((c) => <CartaoCobranca key={c.id} c={c} conta={nomeConta(c.integracao_id)} responsavel={nomeVend(c.responsavel_id)} eu={eu} hoje={hoje} isAdmin={isAdmin}
              marcado={marcadas.has(c.id)} aoMarcar={isAdmin ? (v) => marcar(c.id, v) : null} aoMudar={cobrancas.recarregar} />)}
            {visiveis.length > qtd && <button className="btn btn-bloco" onClick={() => setQtd(qtd + POR_VEZ)}>Mostrar mais ({visiveis.length - qtd})</button>}
          </div>
        )}
      </>)}
    </div>
  )
}
