// Base da marca → Pessoas da marca: quem pode aparecer nas artes geradas pela IA (o profissional, a dona da clínica, a equipe).
// Cada empresa cadastra as suas pessoas. As fotos só entram depois de marcar a autorização de uso de imagem
// (foto de rosto é dado pessoal: sem autorização, a pessoa não aparece nas artes).
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { useAuth } from '../../auth'
import { BotaoEnviar, Miniatura } from './marketing/peca/arquivos'

export type Foto = { caminho: string; nome: string }
export type PessoaMarca = { id: string; empresa_id: string; nome: string; papel: string | null; fotos: Foto[]; autorizado: boolean; autorizado_em: string | null; ativo: boolean }

export function usePessoasMarca(empresa: string) {
  return useConsulta<PessoaMarca[]>(() => supabase.from('marca_pessoas').select('*').eq('empresa_id', empresa).eq('ativo', true).order('criado_em'), [empresa])
}

// nomes das pessoas marcadas numa peça (a ajuda da orientação usa nas frases prontas)
export function useNomesPessoas(empresa: string, ids: string[]) {
  const pessoas = usePessoasMarca(empresa).dados ?? []
  return pessoas.filter((p) => ids.includes(p.id)).map((p) => p.nome)
}

function Pessoa({ p, aoMudar }: { p: PessoaMarca; aoMudar: () => void }) {
  const { session } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const gravar = async (campos: Partial<PessoaMarca>) => {
    setErro(null)
    const { error } = await supabase.from('marca_pessoas').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', p.id)
    if (error) return setErro(msgErro(error))
    aoMudar()
  }
  const autorizar = (sim: boolean) => {
    if (!sim && p.fotos.length) return setErro('Para tirar a autorização, tire antes as fotos desta pessoa.')
    gravar({ autorizado: sim, autorizado_em: sim ? new Date().toISOString() : null, ...(sim ? { autorizado_por: session?.user.id } as object : {}) })
  }
  return (
    <div className="pessoa-cartao">
      <div className="pessoa-topo">
        <input className="pessoa-nome" defaultValue={p.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== p.nome && gravar({ nome: e.target.value.trim() })} aria-label="Nome" />
        <input defaultValue={p.papel ?? ''} placeholder="Função pública (ex.: especialista e professora)" onBlur={(e) => e.target.value !== (p.papel ?? '') && gravar({ papel: e.target.value.trim() || null })} aria-label="Função pública" />
        <button className="btn btn-mini" onClick={() => gravar({ ativo: false })} title="Tirar esta pessoa da lista"><Icone nome="lixeira" tam={14} /> Tirar</button>
      </div>
      <label className="pp-check"><input type="checkbox" checked={p.autorizado} onChange={(e) => autorizar(e.target.checked)} /> Esta pessoa autorizou, por escrito, o uso da imagem dela para criar artes de divulgação da empresa.</label>
      <div className="pp-refs">
        {p.fotos.map((f, i) => (
          <span key={f.caminho} className="pp-ref"><Miniatura caminho={f.caminho} nome={f.nome} />
            <button type="button" className="pp-cor-tirar" aria-label={`Tirar ${f.nome}`} onClick={() => gravar({ fotos: p.fotos.filter((_, k) => k !== i) })}><Icone nome="fechar" tam={12} /></button></span>
        ))}
        <BotaoEnviar pasta={`agentes/marca/${p.empresa_id}/pessoas/${p.id}`} texto="Enviar foto" classe="btn btn-contorno btn-mini" aceita="image/*" desligado={!p.autorizado}
          aoEnviar={(caminho, nome) => gravar({ fotos: [...p.fotos, { caminho, nome }] })} />
      </div>
      <span className="muted pequeno">{p.autorizado ? `${p.fotos.length} foto(s). O ideal são 5 a 10: rosto de frente, de lado, sorrindo, de corpo inteiro, com boa luz.` : 'Marque a autorização para poder enviar as fotos.'}</span>
      <Erro msg={erro} />
    </div>
  )
}

export function PessoasMarca({ empresa, aoMudar }: { empresa: string; aoMudar?: () => void }) {
  const consulta = usePessoasMarca(empresa)
  // quem mostra o resumo das pessoas (Base da marca) é avisado a cada mudança
  const pessoas = { ...consulta, recarregar: () => { consulta.recarregar(); aoMudar?.() } }
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const incluir = async () => {
    if (!nome.trim()) return
    setErro(null)
    const { error } = await supabase.from('marca_pessoas').insert({ empresa_id: empresa, nome: nome.trim() })
    if (error) return setErro(msgErro(error))
    setNome(''); pessoas.recarregar()
  }
  return (
    <div className="pessoas-marca">
      {(pessoas.dados ?? []).map((p) => <Pessoa key={p.id} p={p} aoMudar={pessoas.recarregar} />)}
      {!pessoas.carregando && !(pessoas.dados ?? []).length && <p className="muted pequeno">Ninguém cadastrado ainda.</p>}
      <div className="ia-linha">
        <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && incluir()} placeholder="Nome da pessoa" aria-label="Nome da nova pessoa" />
        <button className="btn btn-contorno-ouro" disabled={!nome.trim()} onClick={incluir}><Icone nome="mais" tam={16} /> Incluir pessoa</button>
      </div>
      <Erro msg={erro ?? pessoas.erro} />
    </div>
  )
}
