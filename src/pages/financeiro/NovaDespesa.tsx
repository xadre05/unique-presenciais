// Lançar ou editar uma despesa. Pode repetir todo mês (aluguel, ferramentas, salários): cria uma linha por mês.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { hojeISO, somaMeses } from '../../lib/format'
import { Campo, Erro, InputMoeda, InputNumero, Modal } from '../../components/ui'
import { CATEGORIAS, useContasFin, type Despesa } from './dados'

type Props = { inicial?: Despesa | null; aoFechar: () => void; aoSalvar: () => void }

export function NovaDespesa({ inicial, aoFechar, aoSalvar }: Props) {
  const contas = useContasFin()
  const [d, setD] = useState<Despesa>(inicial ?? { descricao: '', categoria: CATEGORIAS[0], fornecedor: null, valor: 0, vencimento: hojeISO(), pago_em: null, conta_id: null, observacao: null })
  const [repetir, setRepetir] = useState(1)
  const [jaPaga, setJaPaga] = useState(!!inicial?.pago_em)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const mudar = (p: Partial<Despesa>) => setD({ ...d, ...p })

  const salvar = async () => {
    if (!d.descricao.trim()) return setErro('Escreva o que é a despesa.')
    if (!(d.valor > 0)) return setErro('Informe o valor.')
    setSalvando(true); setErro(null)
    const base = { ...d, descricao: d.descricao.trim(), pago_em: jaPaga ? (d.pago_em ?? d.vencimento) : null, atualizado_em: new Date().toISOString() }
    let error
    if (inicial?.id) {
      ({ error } = await supabase.from('despesas').update(base).eq('id', inicial.id))
    } else {
      const grupo = repetir > 1 ? crypto.randomUUID() : null
      const linhas = Array.from({ length: repetir }, (_, i) => ({
        ...base, vencimento: somaMeses(d.vencimento, i), pago_em: i === 0 ? base.pago_em : null,
        grupo, parcela: repetir > 1 ? i + 1 : null, parcelas: repetir > 1 ? repetir : null,
      }))
      ;({ error } = await supabase.from('despesas').insert(linhas))
    }
    setSalvando(false)
    if (error) return setErro(error.message)
    aoSalvar()
  }

  return (
    <Modal titulo={inicial?.id ? 'Editar despesa' : 'Nova despesa'} aberto onFechar={aoFechar}>
      <Campo rotulo="O que é"><input value={d.descricao} onChange={(e) => mudar({ descricao: e.target.value })} placeholder="Ex.: Anúncios Meta de outubro" autoFocus /></Campo>
      <div className="form-grade">
        <Campo rotulo="Categoria"><select value={d.categoria} onChange={(e) => mudar({ categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Campo>
        <Campo rotulo="Fornecedor ou pessoa (opcional)"><input value={d.fornecedor ?? ''} onChange={(e) => mudar({ fornecedor: e.target.value || null })} /></Campo>
        <Campo rotulo="Valor"><InputMoeda valor={d.valor || null} onChange={(v) => mudar({ valor: v ?? 0 })} /></Campo>
        <Campo rotulo="Vencimento"><input type="date" value={d.vencimento} onChange={(e) => e.target.value && mudar({ vencimento: e.target.value })} /></Campo>
        <Campo rotulo="Sai de qual conta (opcional)"><select value={d.conta_id ?? ''} onChange={(e) => mudar({ conta_id: e.target.value || null })}>
          <option value="">Não informar</option>{contas.filter((c) => c.ativa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        {!inicial?.id && <Campo rotulo="Repetir todo mês" dica="Cria uma despesa por mês, a partir do vencimento."><InputNumero valor={repetir} onChange={setRepetir} min={1} max={36} sufixo={repetir === 1 ? 'só esta' : 'meses'} /></Campo>}
      </div>
      <label className="check"><input type="checkbox" checked={jaPaga} onChange={(e) => setJaPaga(e.target.checked)} /> Já está paga{repetir > 1 ? ' (só a primeira)' : ''}</label>
      {jaPaga && <Campo rotulo="Pago em"><input type="date" value={d.pago_em ?? d.vencimento} onChange={(e) => mudar({ pago_em: e.target.value || null })} /></Campo>}
      <Campo rotulo="Observação (opcional)"><textarea rows={2} value={d.observacao ?? ''} onChange={(e) => mudar({ observacao: e.target.value || null })} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}
