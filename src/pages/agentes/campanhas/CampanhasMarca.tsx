// Base da marca → Campanhas: lista à esquerda (busca e situação) e detalhe ou formulário à direita.
// Encerrar tira a campanha das listas de planejamento; nada é apagado.
import { useState } from 'react'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { produtosDe } from '../marca/dados'
import { FormCampanha } from './FormCampanha'
import { DetalheCampanha } from './DetalheCampanha'
import {
  NOME_SITUACAO, TOM_SITUACAO, campanhaVazia, campanhasDe, gravarCampanhas, linhaCampanha, periodoCampanha, situacaoCampanha,
  type CampanhaGuardada, type SituacaoCampanha,
} from './dados'

type Props = { empresa: string; perfil: Record<string, unknown>; aoSalvar: () => void }
type Filtro = '' | SituacaoCampanha
const ORDEM: Record<SituacaoCampanha, number> = { ativa: 0, agendada: 1, sem_data: 2, encerrada: 3 }

function Lista({ campanhas, aberta, aoAbrir }: { campanhas: CampanhaGuardada[]; aberta?: string; aoAbrir: (id: string) => void }) {
  if (!campanhas.length) return <p className="muted pequeno">Nenhuma campanha nesta busca.</p>
  return (
    <ul className="camp-cartoes">{campanhas.map((c) => {
      const s = situacaoCampanha(c)
      return (
        <li key={c.id}><button type="button" className={`camp-cartao${aberta === c.id ? ' ativa' : ''}${s === 'encerrada' ? ' encerrada' : ''}`} onClick={() => aoAbrir(c.id)}>
          <b>{c.nome}</b><span className={`badge ${TOM_SITUACAO[s]}`}>{NOME_SITUACAO[s]}</span>
          <small className="muted">{periodoCampanha(c)}</small><small>{linhaCampanha(c)}</small>
        </button></li>)
    })}</ul>
  )
}

export function CampanhasMarca({ empresa, perfil, aoSalvar }: Props) {
  const todas = campanhasDe(perfil)
  const produtos = produtosDe(perfil)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('')
  const [abertaId, setAbertaId] = useState<string | undefined>()
  const [editando, setEditando] = useState<{ c: CampanhaGuardada; nova: boolean } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const termo = busca.trim().toLowerCase()
  const lista = todas.filter((c) => (!filtro || situacaoCampanha(c) === filtro) && (!termo || c.nome.toLowerCase().includes(termo)))
    .sort((a, b) => ORDEM[situacaoCampanha(a)] - ORDEM[situacaoCampanha(b)] || (b.inicio ?? '').localeCompare(a.inicio ?? ''))
  // sem escolha, abre a primeira da lista (a ativa mais recente)
  const aberta = todas.find((c) => c.id === abertaId) ?? lista[0]

  const gravar = async (mudar: (l: CampanhaGuardada[]) => CampanhaGuardada[]) => {
    const { error } = await gravarCampanhas(empresa, mudar)
    if (error) return msgErro(error)
    aoSalvar(); return null
  }
  const salvar = async (c: CampanhaGuardada) => {
    const e = await gravar((l) => (l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [...l, c]))
    if (!e) { setEditando(null); setAbertaId(c.id) }
    return e
  }
  // no celular o detalhe fica embaixo da lista: leva até ele
  const mostrar = () => requestAnimationFrame(() => { if (window.innerWidth < 900) document.querySelector('.camp-lado')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
  const encerrar = async (c: CampanhaGuardada, encerrada: boolean) => setErro(await gravar((l) => l.map((x) => (x.id === c.id ? { ...x, encerrada } : x))))

  return (
    <div className="camp-pagina">
      <div className="camp-barra">
        <label className="camp-busca"><Icone nome="busca" tam={16} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campanha…" /></label>
        <span className="select-icone"><select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Situação">
          <option value="">Todas as situações</option>{(Object.keys(NOME_SITUACAO) as SituacaoCampanha[]).map((s) => <option key={s} value={s}>{NOME_SITUACAO[s]}</option>)}
        </select></span>
        <button type="button" className="btn btn-contorno-ouro camp-nova" onClick={() => { setEditando({ c: campanhaVazia(), nova: true }); mostrar() }}><Icone nome="mais" tam={15} /> Nova campanha</button>
      </div>
      <Erro msg={erro} />
      {!todas.length && !editando ? <p className="muted">Nenhuma campanha ainda. Crie a primeira: Black, lançamento, semana de vendas de um produto ou uma ação para ganhar seguidores.</p> : (
        <div className="camp-grade">
          <Lista campanhas={lista} aberta={editando ? undefined : aberta?.id} aoAbrir={(id) => { setEditando(null); setAbertaId(id); mostrar() }} />
          <div className="camp-lado">
            {editando ? <FormCampanha key={editando.c.id} inicial={editando.c} nova={editando.nova} produtos={produtos} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />
              : aberta && <DetalheCampanha key={aberta.id} empresa={empresa} c={aberta} produtos={produtos} aoEditar={() => { setEditando({ c: aberta, nova: false }); mostrar() }} aoEncerrar={(v) => encerrar(aberta, v)} />}
          </div>
        </div>)}
    </div>
  )
}
