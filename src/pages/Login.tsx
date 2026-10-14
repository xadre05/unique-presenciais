import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Campo, Erro } from '../components/ui'

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setAviso(null); setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw new Error(error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message.includes('not confirmed') ? 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).' : error.message)
      } else if (modo === 'criar') {
        if (nome.trim().length < 2) throw new Error('Digite seu nome.')
        if (senha.length < 8) throw new Error('A senha precisa de pelo menos 8 caracteres.')
        const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome: nome.trim() }, emailRedirectTo: window.location.origin } })
        if (error) throw new Error(error.message.includes('already') ? 'Já existe uma conta com esse e-mail. Use "Entrar".' : error.message)
        if (!data.session) {
          // entra direto com a conta recém-criada
          const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: senha })
          if (e2) {
            setModo('entrar')
            setAviso('Conta criada! Agora é só entrar com o seu e-mail e a senha que você acabou de criar.')
          }
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setAviso('Se o e-mail existir, você vai receber um link para criar uma nova senha.')
      }
    } catch (e) {
      setErro((e as Error).message)
    } finally { setEnviando(false) }
  }

  return (
    <div className="tela-centro">
      <form className="cartao-login" onSubmit={enviar}>
        <div className="marca">Unique <em>Presenciais</em></div>
        <p className="muted">Controle de turmas, matrículas, pagamentos e comissões dos cursos presenciais.</p>
        {modo === 'criar' && <Campo rotulo="Seu nome"><input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Campo>}
        <Campo rotulo="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={modo !== 'criar'} /></Campo>
        {modo !== 'esqueci' && <Campo rotulo="Senha"><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></Campo>}
        <Erro msg={erro} />
        {aviso && <div className="aviso">{aviso}</div>}
        <button className="btn btn-ouro btn-bloco" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
        </button>
        <div className="login-links">
          {modo !== 'entrar' && <button type="button" className="link" onClick={() => setModo('entrar')}>Já tenho conta</button>}
          {modo !== 'criar' && <button type="button" className="link" onClick={() => setModo('criar')}>Criar minha conta</button>}
          {modo !== 'esqueci' && <button type="button" className="link" onClick={() => setModo('esqueci')}>Esqueci a senha</button>}
        </div>
      </form>
    </div>
  )
}
