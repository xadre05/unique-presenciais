// Na matrícula: de qual campanha é a venda (ex.: Black paga por Pix) e, na Mini Residência, se é só um módulo.
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { dataBR, hojeISO } from '../lib/format'
import { Campo } from '../components/ui'

type Props = {
  campanhaId: string; aoMudarCampanha: (id: string) => void
  encontros: { id: string; titulo: string; data_inicio: string }[]; encontroId: string; aoMudarEncontro: (id: string) => void
}

export function CampoCampanha({ campanhaId, aoMudarCampanha, encontros, encontroId, aoMudarEncontro }: Props) {
  const hoje = hojeISO()
  const lista = useConsulta<{ id: string; nome: string; inicio: string | null; fim: string | null }[]>(
    () => supabase.from('campanhas_vendas').select('id,nome,inicio,fim').order('inicio', { ascending: false, nullsFirst: false }), [])
  const valendo = (lista.dados ?? []).filter((c) => (!c.fim || c.fim >= hoje) || c.id === campanhaId)
  return (
    <div className="form-grade">
      <Campo rotulo="Campanha (opcional)" dica="Venda de campanha paga fora da Hotmart (ex.: Pix): marque para contar no painel de Campanhas.">
        <select value={campanhaId} onChange={(e) => aoMudarCampanha(e.target.value)}>
          <option value="">Nenhuma</option>
          {valendo.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.fim ? ` (até ${dataBR(c.fim)})` : ''}</option>)}
        </select>
      </Campo>
      {encontros.length > 1 && (
        <Campo rotulo="Módulos" dica="Na Black, a aluna compra um módulo só: escolha qual. A vaga é descontada só nele.">
          <select value={encontroId} onChange={(e) => aoMudarEncontro(e.target.value)}>
            <option value="">Todos os módulos da turma</option>
            {encontros.map((e) => <option key={e.id} value={e.id}>Só {e.titulo} ({dataBR(e.data_inicio)})</option>)}
          </select>
        </Campo>
      )}
    </div>
  )
}
