// Importar os arquivos da Hotmart: Extrato da Carteira (CSV) e vendas do Parcelado Hotmart (Excel ou CSV).
// Escolhe a conta, solta os arquivos; o sistema reconhece cada um pelo cabeçalho e não duplica o que já entrou.
import { useRef, useState } from 'react'
import { dataBR } from '../../../lib/format'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { lerPlanilha } from './planilha'
import { NOME_TIPO, gravar, resumir } from './importar'

type Envio = { nome: string; estado: string; erro?: boolean }
type Props = { contas: { id: string; nome: string }[]; aoImportar: () => void }

export function ImportarHotmart({ contas, aoImportar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [conta, setConta] = useState(contas[0]?.id ?? '')
  const [envios, setEnvios] = useState<Envio[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const marcar = (nome: string, estado: string, erro = false) => setEnvios((l) => l.map((e) => (e.nome === nome ? { nome, estado, erro } : e)))
  const enviar = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? [])
    const alvo = conta || contas[0]?.id
    if (!arquivos.length) return
    if (!alvo) return setErro('Nenhuma conta Hotmart cadastrada.')
    setErro(null); setEnvios(arquivos.map((a) => ({ nome: a.name, estado: 'Na fila' })))
    for (const a of arquivos) {
      try {
        marcar(a.name, 'Lendo…')
        const linhas = await lerPlanilha(a)
        const r = resumir(linhas)
        if (r.tipo === 'desconhecido') { marcar(a.name, 'Não reconheci este arquivo (envie o Extrato ou as vendas do Parcelado Hotmart).', true); continue }
        const periodo = r.de ? ` · ${dataBR(r.de)} a ${dataBR(r.ate)}` : ''
        const g = await gravar(alvo, linhas, (n) => marcar(a.name, `${NOME_TIPO[r.tipo]}${periodo} · gravando ${n} de ${r.linhas}…`))
        marcar(a.name, `${NOME_TIPO[r.tipo]}${periodo} · ${g.total} linhas, ${g.novas} novas${g.novas < g.total ? ` (${g.total - g.novas} já estavam)` : ''}`)
      } catch (e) { marcar(a.name, (e as Error).message, true) }
    }
    if (entrada.current) entrada.current.value = ''
    aoImportar()
  }
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>Importar da Hotmart</h2><span className="muted pequeno">Carteira → Extrato → Exportar (CSV) · Vendas → Gestão do Parcelado Hotmart → Exportar</span></div>
      <div className="mat-linha">
        <label className="select-icone"><Icone nome="links" tam={16} /><select value={conta} onChange={(e) => setConta(e.target.value)} aria-label="Conta da Hotmart">
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <button type="button" className="btn btn-ouro" onClick={() => entrada.current?.click()}><Icone nome="importar" tam={16} /> Escolher arquivos</button>
        <input ref={entrada} type="file" accept=".csv,.xls,.xlsx,text/csv" multiple hidden onChange={(e) => enviar(e.target.files)} />
      </div>
      <p className="muted pequeno">Escolha primeiro de qual conta são os arquivos. Pode mandar vários de uma vez e repetir períodos: o que já entrou não duplica.</p>
      <Erro msg={erro} />
      {envios.length > 0 && <ul className="bib-envios">{envios.map((e) => <li key={e.nome} className={e.erro ? 'erro' : ''}><b>{e.nome}</b> <span>{e.estado}</span></li>)}</ul>}
    </section>
  )
}
