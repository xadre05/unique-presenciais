// Dados da empresa, prazo e os modelos da carta e do WhatsApp da notificação extrajudicial (o advogado revisa o texto)
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Campo, Erro, InputNumero, Modal } from '../../../components/ui'
import type { Config } from './modelo'
import { EmailEnvio } from './EmailEnvio'

const CAMPOS_CARTA = '{nome} {primeiro_nome} {cpf} {email} {detalhamento} {valor_principal} {valor_encargos} {valor_total} {multa_pct} {juros_pct} {produto} {primeira_em_aberto} {parcelas_em_aberto} {prazo} {link_boleto} {data_envio} {razao_social} {cnpj} {endereco} {cidade} {email_contato} {whatsapp_contato} {remetente_nome}'

type Props = { cfg: Config; eu: string; aoFechar: () => void; aoSalvar: () => void }

export function ConfigNotificacao({ cfg, eu, aoFechar, aoSalvar }: Props) {
  const [v, setV] = useState<Config>(cfg)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const txt = (k: keyof Config) => ({ value: String(v[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }) })
  const salvar = async () => {
    setSalvando(true); setErro(null)
    const { pct_comissao: _pct, ...campos } = v
    // mudou o texto depois de o advogado liberar: a liberação cai e ele precisa revisar de novo
    const mudouTexto = v.carta_modelo !== cfg.carta_modelo || v.carta_assunto !== cfg.carta_assunto
    if (mudouTexto && cfg.advogado_liberou_em && v.advogado_liberou_em === cfg.advogado_liberou_em) { campos.advogado_liberou_em = null; campos.advogado_liberou_por = null }
    void _pct
    const { error } = await supabase.from('cobranca_config').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', true)
    if (error) { setSalvando(false); return setErro(error.message) }
    aoSalvar()
  }
  return (
    <Modal titulo="Notificação extrajudicial — dados e modelos" aberto onFechar={aoFechar} largo>
      <EmailEnvio />
      <div className="not-config">
        <Campo rotulo="Razão social"><input {...txt('razao_social')} placeholder="Como está no CNPJ" /></Campo>
        <Campo rotulo="CNPJ"><input {...txt('cnpj')} /></Campo>
        <Campo rotulo="Endereço da sede"><input {...txt('endereco')} /></Campo>
        <Campo rotulo="Cidade (aparece no topo da carta)"><input {...txt('cidade')} /></Campo>
        <Campo rotulo="E-mail para respostas e comprovantes"><input {...txt('email_contato')} /></Campo>
        <Campo rotulo="WhatsApp para comprovantes"><input {...txt('whatsapp_contato')} /></Campo>
        <Campo rotulo="Nome que assina o WhatsApp"><input {...txt('remetente_nome')} /></Campo>
        <Campo rotulo="Prazo para pagar (dias)" dica="O boleto vence nesse prazo. A negativação só pode ser pedida 5 dias depois do vencimento."><InputNumero valor={v.prazo_dias} onChange={(n) => setV({ ...v, prazo_dias: n })} min={1} max={30} sufixo="dias" /></Campo>
        <Campo rotulo="Só compras até" dica="Compras depois disso podem ter tido antecipação ou negativação pela própria Hotmart: ficam paradas."><input type="date" value={v.compra_ate} onChange={(e) => e.target.value && setV({ ...v, compra_ate: e.target.value })} /></Campo>
        <Campo rotulo="Multa sobre cada parcela vencida"><InputNumero valor={Number(v.multa_pct)} onChange={(n) => setV({ ...v, multa_pct: n })} min={0} max={2} sufixo="%" /></Campo>
        <Campo rotulo="Juros de mora ao mês"><InputNumero valor={Number(v.juros_mes_pct)} onChange={(n) => setV({ ...v, juros_mes_pct: n })} min={0} max={1} sufixo="%" /></Campo>
      </div>
      <label className="check not-libera"><input type="checkbox" checked={!!v.advogado_liberou_em} onChange={(e) => setV({ ...v, advogado_liberou_em: e.target.checked ? new Date().toISOString() : null, advogado_liberou_por: e.target.checked ? eu : null })} />
        {' '}O advogado revisou esta carta e liberou o envio{v.advogado_liberou_em ? ` (marcado por ${v.advogado_liberou_por ?? eu})` : ''}</label>
      <Campo rotulo="Assunto do e-mail"><input {...txt('carta_assunto')} /></Campo>
      <Campo rotulo="Carta (texto do e-mail)" dica="Revisada pelo advogado antes do primeiro envio. Se mudar o texto, peça para ele revisar de novo."><textarea rows={16} {...txt('carta_modelo')} /></Campo>
      <Campo rotulo="Mensagem de WhatsApp (enviada no mesmo dia)"><textarea rows={4} {...txt('whatsapp_modelo')} /></Campo>
      <p className="muted pequeno">Campos que o sistema preenche: {CAMPOS_CARTA}</p>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}
