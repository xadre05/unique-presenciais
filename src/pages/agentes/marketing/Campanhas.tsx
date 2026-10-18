// Campanha: escolher qual está em foco e criar uma nova (nome, período e o que ela vende).
// Fica guardada no perfil do agente de Marketing; as peças pedidas dentro dela levam a campanha junto.
import { useState } from 'react'
import { msgErro } from '../../../lib/dados'
import { Campo, Erro, Modal } from '../../../components/ui'
import { atualizarPerfil } from '../memoria'
import { EMPRESA, type Campanha } from './useMarketing'

export const TODAS = ''

export function SeletorCampanha({ campanhas, valor, aoMudar, aoCriar }: { campanhas: Campanha[]; valor: string; aoMudar: (id: string) => void; aoCriar: () => void }) {
  return (
    <div className="mk-campanha">
      <span className="muted">Campanha</span>
      <label className="select-icone">
        <select value={valor} onChange={(e) => (e.target.value === '__nova' ? aoCriar() : aoMudar(e.target.value))}>
          <option value={TODAS}>Todas as peças</option>
          {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          <option value="__nova">+ Nova campanha…</option>
        </select>
      </label>
    </div>
  )
}

const vazia = { nome: '', inicio: '', fim: '', descricao: '' }

export function NovaCampanha({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [f, setF] = useState(vazia)
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async () => {
    if (!f.nome.trim()) return setErro('Dê um nome para a campanha.')
    const nova: Campanha = { id: crypto.randomUUID(), nome: f.nome.trim(), inicio: f.inicio || undefined, fim: f.fim || undefined, descricao: f.descricao.trim() || undefined }
    const { error } = await atualizarPerfil(EMPRESA, 'marketing', (p) => ({ ...p, campanhas: [...(Array.isArray(p.campanhas) ? p.campanhas : []), nova] }))
    if (error) return setErro(msgErro(error))
    setF(vazia); setErro(null); aoCriar(nova.id)
  }
  return (
    <Modal titulo="Nova campanha" aberto={aberto} onFechar={aoFechar}>
      <div className="mk-form">
        <p className="pequeno muted">A campanha existe só aqui no agente: serve para agrupar as peças e dizer ao agente o foco delas.</p>
        <Campo rotulo="Nome"><input value={f.nome} onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} placeholder="Ex.: Black Friday Limited Edition" /></Campo>
        <div className="form-duas">
          <Campo rotulo="Começa em"><input type="date" value={f.inicio} onChange={(e) => setF((x) => ({ ...x, inicio: e.target.value }))} /></Campo>
          <Campo rotulo="Termina em"><input type="date" value={f.fim} onChange={(e) => setF((x) => ({ ...x, fim: e.target.value }))} /></Campo>
        </div>
        <Campo rotulo="O que a campanha vende e o foco" dica="Oferta, bônus, para quem é, a mensagem principal. Preços e condições ficam em Base da marca → Ofertas e materiais.">
          <textarea rows={4} value={f.descricao} onChange={(e) => setF((x) => ({ ...x, descricao: e.target.value }))} />
        </Campo>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Criar campanha</button></div>
      </div>
    </Modal>
  )
}
