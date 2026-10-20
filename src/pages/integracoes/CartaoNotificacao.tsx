// Cartões das integrações da notificação extrajudicial: Asaas (boleto e negativação) e E-mail (Resend).
// As chaves ficam cifradas no cofre do banco; a tela só mostra se já foram cadastradas.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { Badge, Campo, Erro, Modal } from '../../components/ui'
import { Icone } from '../../components/Icone'

type Campo = { k: string; r: string; d: string; secreto?: boolean }
const CAMPOS: Record<string, Campo[]> = {
  asaas: [
    { k: 'api_key', r: 'Chave de API do Asaas', d: 'No Asaas: Integrações → Chave de API → Gerar chave. Começa com $aact_', secreto: true },
    { k: 'webhook_token', r: 'Token do aviso (webhook)', d: 'Invente uma senha longa, cole aqui e no Asaas (Integrações → Webhooks → Token de autenticação)', secreto: true },
  ],
  email: [
    { k: 'api_key', r: 'Chave de API do Resend', d: 'No Resend: API Keys → Create API Key (permissão de envio). Começa com re_', secreto: true },
    { k: 'remetente', r: 'Remetente', d: 'Nome e e-mail do domínio verificado, ex.: Unique HOF Academy <cobranca@seudominio.com.br>' },
  ],
}
const URL_AVISO = 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/notificacao'

function Chaves({ id, nome, cadastrados, aoFechar, aoSalvar }: { id: string; nome: string; cadastrados: string[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    const preenchidos = Object.entries(v).filter(([, x]) => x.trim())
    if (!preenchidos.length) return setErro('Cole ao menos um campo.')
    setSalvando(true); setErro(null)
    for (const [k, x] of preenchidos) {
      const { error } = await supabase.rpc('salvar_credencial_integracao', { p_integracao: id, p_campo: k, p_valor: x })
      if (error) { setSalvando(false); return setErro(msgErro(error)) }
    }
    aoSalvar()
  }
  return (
    <Modal titulo={`Chaves — ${nome}`} aberto onFechar={aoFechar}>
      <p className="muted pequeno">Gravadas cifradas no banco. Depois de salvas, ninguém vê de volta pela tela: para trocar, cole por cima.</p>
      {CAMPOS[id].map((c) => (
        <Campo key={c.k} rotulo={`${c.r}${cadastrados.includes(c.k) ? ' — já cadastrado ✓' : ''}`} dica={c.d}>
          <input type={c.secreto ? 'password' : 'text'} autoComplete="off" value={v[c.k] ?? ''} placeholder={cadastrados.includes(c.k) ? '(deixe vazio para manter)' : 'Cole aqui'} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
        </Campo>
      ))}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}

function Cartao({ id, nome, texto, passos }: { id: string; nome: string; texto: string; passos: React.ReactNode }) {
  const campos = useConsulta<string[]>(() => supabase.rpc('campos_integracao', { p_integracao: id }), [id])
  const [aberto, setAberto] = useState(false)
  const [ver, setVer] = useState(false)
  const lista = campos.dados ?? []
  const completo = CAMPOS[id].every((c) => lista.includes(c.k))
  return (
    <section className="bloco">
      <div className="bloco-topo"><h2><Icone nome="links" className="ouro" /> {nome}</h2>
        <Badge tom={completo ? 'ok' : lista.length ? 'alerta' : 'neutro'}>{completo ? 'chaves cadastradas' : lista.length ? 'faltam chaves' : 'não configurado'}</Badge></div>
      <p className="muted pequeno">{texto}</p>
      <div className="acoes"><button className="btn btn-contorno btn-mini" onClick={() => setAberto(true)}>Cadastrar chaves</button><button className="btn btn-mini" onClick={() => setVer(!ver)}>{ver ? 'Esconder passo a passo' : 'Passo a passo'}</button></div>
      {ver && passos}
      {aberto && <Chaves id={id} nome={nome} cadastrados={lista} aoFechar={() => setAberto(false)} aoSalvar={() => { setAberto(false); campos.recarregar() }} />}
    </section>
  )
}

export function CartoesNotificacao() {
  const [teste, setTeste] = useState<string | null>(null)
  const testar = async () => {
    setTeste('Testando…')
    const { data, error } = await supabase.functions.invoke('notificacao', { body: { acao: 'testar' } })
    if (error) return setTeste(`Erro: ${error.message}`)
    const a = data.asaas, e = data.email
    setTeste(`Asaas: ${a.ok ? `ok (${a.conta}, ambiente de ${a.ambiente})` : a.erro} · E-mail: ${e.ok ? `ok (${e.remetente})` : e.erro}`)
  }
  return (<>
    <h2 className="titulo-secao">Notificação extrajudicial</h2>
    <Cartao id="asaas" nome="Asaas — boleto e negativação" texto="Gera o boleto (ou Pix) de cada notificação e pede a negativação no Serasa de quem não pagar. Quando a pessoa paga, o Asaas avisa o sistema e a cobrança fecha sozinha."
      passos={<ol className="integ-passos">
        <li>Crie a conta PJ no Asaas e espere a aprovação. A negativação exige CNPJ ativo e saldo na conta.</li>
        <li>Em <b>Integrações → Chave de API</b>, gere a chave e cole aqui em “Cadastrar chaves”.</li>
        <li>Em <b>Integrações → Webhooks</b>, crie um webhook com a URL <code>{URL_AVISO}</code>, os eventos de <b>Cobrança</b> e de <b>Negativação</b>, e um token de autenticação (a mesma senha que você colar aqui).</li>
        <li>Peça ao seu gerente do Asaas para liberar <b>negativação pela API</b>.</li>
      </ol>} />
    <Cartao id="email" nome="E-mail (Resend)" texto="Envia a notificação por e-mail com o domínio da empresa e guarda o número de cada envio (prova de que foi enviado)."
      passos={<ol className="integ-passos">
        <li>Crie a conta em resend.com.</li>
        <li>Em <b>Domains</b>, adicione o domínio da empresa e coloque no DNS os 2 registros que ele mostrar (quem cuida do site faz isso). Espere ficar “Verified”.</li>
        <li>Em <b>API Keys</b>, crie uma chave e cole aqui, junto com o remetente (ex.: Unique HOF Academy &lt;cobranca@seudominio.com.br&gt;).</li>
      </ol>} />
    <div className="acoes"><button className="btn btn-contorno" onClick={testar}>Testar Asaas e e-mail</button>{teste && <span className="muted pequeno">{teste}</span>}</div>
  </>)
}
