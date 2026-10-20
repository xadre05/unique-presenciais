// Dados da empresa, prazo e os modelos da carta e do WhatsApp da notificação extrajudicial (o advogado revisa o texto)
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Campo, Erro, InputNumero, Modal } from '../../../components/ui'
import type { Config } from './modelo'

const CAMPOS_CARTA = '{nome} {primeiro_nome} {cpf} {email} {produto} {data_compra} {parcelas_total} {parcelas_pagas} {valor_parcela} {primeira_em_aberto} {parcelas_em_aberto} {valor_total} {prazo} {link_boleto} {data_envio} {razao_social} {cnpj} {endereco} {cidade} {email_contato} {whatsapp_contato} {remetente_nome}'

type Props = { cfg: Config; aoFechar: () => void; aoSalvar: () => void }

export function ConfigNotificacao({ cfg, aoFechar, aoSalvar }: Props) {
  const [v, setV] = useState<Config>(cfg)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const txt = (k: keyof Config) => ({ value: String(v[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }) })
  const salvar = async () => {
    setSalvando(true); setErro(null)
    const { pct_comissao: _pct, ...campos } = v
    void _pct
    const { error } = await supabase.from('cobranca_config').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', true)
    if (error) { setSalvando(false); return setErro(error.message) }
    aoSalvar()
  }
  return (
    <Modal titulo="Notificação extrajudicial — dados e modelos" aberto onFechar={aoFechar} largo>
      <div className="not-config">
        <Campo rotulo="Razão social"><input {...txt('razao_social')} placeholder="Como está no CNPJ" /></Campo>
        <Campo rotulo="CNPJ"><input {...txt('cnpj')} /></Campo>
        <Campo rotulo="Endereço da sede"><input {...txt('endereco')} /></Campo>
        <Campo rotulo="Cidade (aparece no topo da carta)"><input {...txt('cidade')} /></Campo>
        <Campo rotulo="E-mail para respostas e comprovantes"><input {...txt('email_contato')} /></Campo>
        <Campo rotulo="WhatsApp para comprovantes"><input {...txt('whatsapp_contato')} /></Campo>
        <Campo rotulo="Nome que assina o WhatsApp"><input {...txt('remetente_nome')} /></Campo>
        <Campo rotulo="Prazo para pagar (dias)" dica="O boleto vence nesse prazo. A negativação só pode ser pedida 5 dias depois do vencimento."><InputNumero valor={v.prazo_dias} onChange={(n) => setV({ ...v, prazo_dias: n })} min={1} max={30} sufixo="dias" /></Campo>
      </div>
      <Campo rotulo="Assunto do e-mail"><input {...txt('carta_assunto')} /></Campo>
      <Campo rotulo="Carta (texto do e-mail)" dica="Revisada pelo advogado antes do primeiro envio."><textarea rows={16} {...txt('carta_modelo')} /></Campo>
      <Campo rotulo="Mensagem de WhatsApp (enviada no mesmo dia)"><textarea rows={4} {...txt('whatsapp_modelo')} /></Campo>
      <p className="muted pequeno">Campos que o sistema preenche: {CAMPOS_CARTA}</p>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}
