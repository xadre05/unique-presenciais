// Cadastrar ou editar um serviço pago. Senha e chave não entram aqui: só o e-mail da conta e o endereço do painel.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Campo, Erro, InputMoeda, Modal } from '../../components/ui'
import { CATEGORIAS, NOME_CICLO, SERVICO_NOVO, type Ciclo, type Servico } from './dados'

type Props = { inicial: Servico | null; aoFechar: () => void; aoSalvar: () => void }

function CampoValor({ valor, moeda, aoMudar }: { valor: number | null; moeda: 'BRL' | 'USD'; aoMudar: (v: number | null) => void }) {
  if (moeda === 'BRL') return <InputMoeda valor={valor} onChange={aoMudar} passo={10} />
  return <input inputMode="decimal" value={valor ?? ''} placeholder="US$ 0,00"
    onChange={(e) => { const t = e.target.value.replace(',', '.').replace(/[^\d.]/g, ''); aoMudar(t ? Number(t) : null) }} />
}

export function FormServico({ inicial, aoFechar, aoSalvar }: Props) {
  const [s, setS] = useState<Servico>(inicial ?? SERVICO_NOVO)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const mudar = (p: Partial<Servico>) => setS({ ...s, ...p })
  const usaSaldo = s.ciclo === 'credito' || s.ciclo === 'por_uso'

  const salvar = async () => {
    if (!s.nome.trim()) return setErro('Escreva o nome do serviço.')
    if (s.painel_url && !/^https?:\/\//i.test(s.painel_url)) return setErro('O endereço do painel precisa começar com https://')
    setSalvando(true); setErro(null)
    const mudouSaldo = s.saldo !== (inicial?.saldo ?? null)
    const dados = { ...s, nome: s.nome.trim(), saldo_em: mudouSaldo ? new Date().toISOString() : s.saldo_em, atualizado_em: new Date().toISOString() }
    delete dados.id
    const { error } = inicial?.id
      ? await supabase.from('controle_servicos').update(dados).eq('id', inicial.id)
      : await supabase.from('controle_servicos').insert(dados)
    setSalvando(false)
    if (error) return setErro(error.message)
    aoSalvar()
  }

  return (
    <Modal titulo={inicial?.id ? `Editar ${inicial.nome}` : 'Novo serviço'} aberto onFechar={aoFechar} largo>
      <div className="form-grade">
        <Campo rotulo="Serviço"><input value={s.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Anthropic, StayCloud, Z-API" autoFocus /></Campo>
        <Campo rotulo="Tipo"><select value={s.categoria} onChange={(e) => mudar({ categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Campo>
      </div>
      <Campo rotulo="Para que serve"><input value={s.para_que ?? ''} onChange={(e) => mudar({ para_que: e.target.value || null })} placeholder="Ex.: IA dos agentes" /></Campo>
      <div className="form-grade">
        <Campo rotulo="Como cobra"><select value={s.ciclo} onChange={(e) => mudar({ ciclo: e.target.value as Ciclo })}>
          {(Object.keys(NOME_CICLO) as Ciclo[]).map((c) => <option key={c} value={c}>{NOME_CICLO[c]}</option>)}</select></Campo>
        <Campo rotulo="Moeda"><select value={s.moeda} onChange={(e) => mudar({ moeda: e.target.value as 'BRL' | 'USD' })}><option value="BRL">Real (R$)</option><option value="USD">Dólar (US$)</option></select></Campo>
        <Campo rotulo={usaSaldo ? 'Gasto médio por mês' : s.ciclo === 'anual' ? 'Valor por ano' : 'Valor por mês'}><CampoValor valor={s.valor} moeda={s.moeda} aoMudar={(v) => mudar({ valor: v })} /></Campo>
        <Campo rotulo={usaSaldo ? 'Próxima recarga (opcional)' : 'Próximo vencimento'}><input type="date" value={s.proximo_vencimento ?? ''} onChange={(e) => mudar({ proximo_vencimento: e.target.value || null })} /></Campo>
        {usaSaldo && <Campo rotulo="Crédito que ainda tem"><CampoValor valor={s.saldo} moeda={s.moeda} aoMudar={(v) => mudar({ saldo: v })} /></Campo>}
        {usaSaldo && <Campo rotulo="Avisar quando ficar abaixo de"><CampoValor valor={s.saldo_minimo} moeda={s.moeda} aoMudar={(v) => mudar({ saldo_minimo: v })} /></Campo>}
        <Campo rotulo="Avisar quantos dias antes"><input inputMode="numeric" value={s.alerta_dias} onChange={(e) => mudar({ alerta_dias: Math.min(90, Number(e.target.value.replace(/\D/g, '') || 0)) })} /></Campo>
        <Campo rotulo="Situação"><select value={s.situacao} onChange={(e) => mudar({ situacao: e.target.value as Servico['situacao'] })}>
          <option value="ativo">Ativo</option><option value="cancelar">Cancelar antes de renovar</option><option value="cancelado">Cancelado</option></select></Campo>
        <Campo rotulo="Pago com"><input value={s.forma_pagamento ?? ''} onChange={(e) => mudar({ forma_pagamento: e.target.value || null })} placeholder="Ex.: cartão da empresa, Pix, boleto" /></Campo>
        <Campo rotulo="Responsável"><input value={s.responsavel ?? ''} onChange={(e) => mudar({ responsavel: e.target.value || null })} /></Campo>
        <Campo rotulo="E-mail da conta" dica="A senha não fica aqui."><input type="email" value={s.conta_email ?? ''} onChange={(e) => mudar({ conta_email: e.target.value || null })} /></Campo>
        <Campo rotulo="Endereço do painel"><input value={s.painel_url ?? ''} onChange={(e) => mudar({ painel_url: e.target.value || null })} placeholder="https://" /></Campo>
      </div>
      <Campo rotulo="Observação"><textarea rows={2} value={s.observacao ?? ''} onChange={(e) => mudar({ observacao: e.target.value || null })} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}
