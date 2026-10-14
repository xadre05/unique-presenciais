import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { Historia } from './MatriculaDetalhe'
import { Erro } from '../components/ui'

export default function Historico() {
  const [quem, setQuem] = useState('')
  const [tabela, setTabela] = useState('')
  const [limite, setLimite] = useState(150)
  const q = useConsulta<never[]>(() => {
    let x = supabase.from('historico').select('*').order('em', { ascending: false }).limit(limite)
    if (quem) x = x.eq('usuario_nome', quem)
    if (tabela) x = x.eq('tabela', tabela)
    return x
  }, [quem, tabela, limite])
  const pessoas = useConsulta<{ usuario_nome: string }[]>(() => supabase.from('historico').select('usuario_nome').limit(1000))
  const nomes = [...new Set((pessoas.dados ?? []).map((p) => p.usuario_nome))]
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Histórico de alterações</h1><p className="muted">Tudo que foi criado ou alterado, por quem e quando. Nada é apagado do sistema: o que sai é cancelado com motivo.</p></div>
      </header>
      <div className="filtros">
        <select value={quem} onChange={(e) => setQuem(e.target.value)}><option value="">Todas as pessoas</option>{nomes.map((n) => <option key={n}>{n}</option>)}</select>
        <select value={tabela} onChange={(e) => setTabela(e.target.value)}>
          <option value="">Tudo</option><option value="parcelas">Pagamentos</option><option value="matriculas">Matrículas</option><option value="alunos">Alunos</option>
          <option value="turmas">Turmas</option><option value="comissoes">Comissões</option><option value="perfis">Acessos</option>
        </select>
      </div>
      <Erro msg={q.erro} />
      <section className="bloco"><Historia itens={q.dados ?? []} />
        {(q.dados ?? []).length >= limite && <button className="btn" onClick={() => setLimite(limite + 150)}>Carregar mais</button>}
      </section>
    </div>
  )
}
