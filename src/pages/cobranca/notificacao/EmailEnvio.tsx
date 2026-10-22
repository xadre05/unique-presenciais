// De onde sai o e-mail da notificação: o Gmail da empresa (Google Workspace). Usuário que entra no Gmail, a senha de app
// dele (gravada cifrada no cofre do banco; a tela nunca mostra de volta) e o remetente de "Enviar e-mail como".
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { Badge, Campo, Erro } from '../../../components/ui'

const CAMPOS = [
  { k: 'usuario', r: 'Usuário do Gmail', d: 'O e-mail que faz login (o dono do apelido de cobrança), ex.: administracao@suaempresa.com.br', exemplo: 'administracao@uniquehofacademy.com.br' },
  { k: 'senha_app', r: 'Senha de app', d: 'As 16 letras de myaccount.google.com/apppasswords (com ou sem espaços)', secreto: true },
  { k: 'remetente', r: 'Remetente', d: 'Nome e e-mail que o aluno vê, já liberado em "Enviar e-mail como"', exemplo: 'Unique HOF Academy - Cobrança <cobranca@uniquehofacademy.com.br>' },
]

export function EmailEnvio() {
  const campos = useConsulta<string[]>(() => supabase.rpc('campos_integracao', { p_integracao: 'email' }), [])
  const [v, setV] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const lista = campos.dados ?? []
  const completo = CAMPOS.every((c) => lista.includes(c.k))

  const salvar = async () => {
    const preenchidos = Object.entries(v).filter(([, x]) => x.trim())
    if (!preenchidos.length) return setErro('Preencha ao menos um campo.')
    setOcupado(true); setErro(null); setAviso(null)
    for (const [k, x] of preenchidos) {
      const { error } = await supabase.rpc('salvar_credencial_integracao', { p_integracao: 'email', p_campo: k, p_valor: x })
      if (error) { setOcupado(false); return setErro(msgErro(error)) }
    }
    setV({}); setOcupado(false); setAviso('Salvo. Agora clique em "Enviar e-mail de teste".'); campos.recarregar()
  }
  const testar = async () => {
    setOcupado(true); setErro(null); setAviso('Enviando o teste…')
    const { data, error } = await supabase.functions.invoke('notificacao', { body: { acao: 'testar' } })
    setOcupado(false)
    if (error) { setAviso(null); return setErro(error.message) }
    const e = data?.email
    if (e?.ok) setAviso(`Funcionou: o teste saiu de ${e.remetente} para ${e.para}. Confira a caixa de entrada.`)
    else { setAviso(null); setErro(e?.erro ?? 'Não consegui testar.') }
  }

  return (
    <section className="not-email">
      <div className="bloco-topo"><h3>E-mail de envio</h3>
        <Badge tom={completo ? 'ok' : lista.length ? 'alerta' : 'neutro'}>{completo ? 'configurado' : lista.length ? 'incompleto' : 'não configurado'}</Badge></div>
      <div className="not-config">
        {CAMPOS.map((c) => (
          <Campo key={c.k} rotulo={`${c.r}${lista.includes(c.k) ? ' ✓' : ''}`} dica={c.d}>
            <input type={c.secreto ? 'password' : 'text'} autoComplete="off" value={v[c.k] ?? ''} placeholder={lista.includes(c.k) ? '(já cadastrado: deixe vazio para manter)' : c.exemplo ?? 'Cole aqui'}
              onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
          </Campo>
        ))}
      </div>
      <div className="acoes">
        <button type="button" className="btn btn-contorno btn-mini" disabled={ocupado} onClick={salvar}>Salvar e-mail de envio</button>
        <button type="button" className="btn btn-mini" disabled={ocupado || !completo} onClick={testar}>Enviar e-mail de teste</button>
        {aviso && <span className="muted pequeno">{aviso}</span>}
      </div>
      <Erro msg={erro} />
    </section>
  )
}
