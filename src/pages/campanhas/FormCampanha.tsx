// Cadastrar ou editar uma campanha de venda: período, formulário da página, ofertas da Hotmart e metas.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Campo, Erro, InputMoeda, Modal } from '../../components/ui'
import { CAMPANHA_NOVA, type Campanha } from './dados'

type Props = { inicial: Campanha | null; aoFechar: () => void; aoSalvar: (id: string) => void }
type Oferta = { oferta_codigo: string; observacao: string | null }

export function FormCampanha({ inicial, aoFechar, aoSalvar }: Props) {
  const [c, setC] = useState<Campanha>(inicial ?? CAMPANHA_NOVA)
  const [outras, setOutras] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const forms = useConsulta<{ slug: string; nome: string }[]>(() => supabase.from('crm_formularios').select('slug,nome').eq('ativo', true).order('nome'), [])
  const ofertas = useConsulta<Oferta[]>(() => supabase.from('hotmart_ofertas_cursos').select('oferta_codigo,observacao').order('criado_em', { ascending: false }), [])
  const mudar = (p: Partial<Campanha>) => setC({ ...c, ...p })
  const marcar = (cod: string, sim: boolean) => mudar({ ofertas: sim ? [...new Set([...c.ofertas, cod])] : c.ofertas.filter((o) => o !== cod) })

  const salvar = async () => {
    if (!c.nome.trim()) return setErro('Dê um nome para a campanha.')
    if (c.inicio && c.fim && c.fim < c.inicio) return setErro('O fim não pode ser antes do início.')
    const extras = outras.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)
    const dados = { ...c, nome: c.nome.trim(), ofertas: [...new Set([...c.ofertas, ...extras])] }
    delete dados.id
    setSalvando(true); setErro(null)
    const r = inicial?.id
      ? await supabase.from('campanhas_vendas').update(dados).eq('id', inicial.id).select('id').single()
      : await supabase.from('campanhas_vendas').insert(dados).select('id').single()
    setSalvando(false)
    if (r.error) return setErro(r.error.message)
    aoSalvar(r.data.id)
  }

  return (
    <Modal titulo={inicial?.id ? `Editar ${inicial.nome}` : 'Nova campanha'} aberto onFechar={aoFechar} largo>
      <Campo rotulo="Nome"><input value={c.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Black Friday Limited Edition" autoFocus /></Campo>
      <div className="form-grade">
        <Campo rotulo="Começa em"><input type="date" value={c.inicio ?? ''} onChange={(e) => mudar({ inicio: e.target.value || null })} /></Campo>
        <Campo rotulo="Termina em"><input type="date" value={c.fim ?? ''} onChange={(e) => mudar({ fim: e.target.value || null })} /></Campo>
        <Campo rotulo="Meta de vendas"><input inputMode="numeric" value={c.meta_vendas ?? ''} onChange={(e) => mudar({ meta_vendas: Number(e.target.value.replace(/\D/g, '')) || null })} placeholder="Ex.: 200" /></Campo>
        <Campo rotulo="Meta de faturamento bruto"><InputMoeda valor={c.meta_receita} onChange={(v) => mudar({ meta_receita: v })} passo={1000} /></Campo>
        <Campo rotulo="Formulário da página" dica="Onde a página manda os leads (Atendimento → Captura de leads).">
          <select value={c.formulario_slug ?? ''} onChange={(e) => mudar({ formulario_slug: e.target.value || null })}>
            <option value="">Sem página própria</option>{(forms.dados ?? []).map((f) => <option key={f.slug} value={f.slug}>{f.nome}</option>)}
          </select></Campo>
        <Campo rotulo="Etiqueta dos contatos" dica="Para filtrar em Contatos."><input value={c.etiqueta ?? ''} onChange={(e) => mudar({ etiqueta: e.target.value.trim().toLowerCase() || null })} placeholder="ex.: black-2026" /></Campo>
      </div>
      <Campo rotulo="Ofertas da Hotmart que contam como venda da campanha" dica="O código depois de off= no link do checkout.">
        <div className="cmp-ofertas">{(ofertas.dados ?? []).map((o) => (
          <label key={o.oferta_codigo} className="check"><input type="checkbox" checked={c.ofertas.includes(o.oferta_codigo)} onChange={(e) => marcar(o.oferta_codigo, e.target.checked)} /> <code>{o.oferta_codigo}</code> <span className="muted pequeno">{o.observacao ?? ''}</span></label>
        ))}</div>
        <input value={outras} onChange={(e) => setOutras(e.target.value)} placeholder="Outros códigos, separados por vírgula" />
        {c.ofertas.filter((o) => !(ofertas.dados ?? []).some((x) => x.oferta_codigo === o)).length > 0 && <p className="muted pequeno">Também: {c.ofertas.filter((o) => !(ofertas.dados ?? []).some((x) => x.oferta_codigo === o)).join(', ')}</p>}
      </Campo>
      <Campo rotulo="Observação"><textarea rows={2} value={c.observacao ?? ''} onChange={(e) => mudar({ observacao: e.target.value || null })} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}
