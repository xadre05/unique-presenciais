// Configurar um agente, em 4 quadros: Funcionamento (ligado, modelo, modo econômico), Instruções específicas,
// Créditos do agente e Preferências (o que ele aprendeu ou a equipe ensinou). Fica no perfil do agente
// (agentes_empresa.perfil), junto com o que já estiver lá; as preferências gravam na hora, o resto em "Salvar configurações".
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { MODELOS } from './comum'
import { CreditosAgente } from './CreditosAgente'
import { QuadroFluxo } from './marketing/QuadroFluxo'
import { atualizarPerfil, esquecer, lembrar, memoriaDe, type Lembranca } from './memoria'

export type ConfigDoAgente = { modelo?: string; limite_mes_creditos?: number | null; instrucoes?: string }
type Props = { empresaId: string; agenteId: string; ativo: boolean; perfil: Record<string, unknown>; aoSalvar: () => void }

const ORIGEM: Record<Lembranca['origem'], string> = { manual: 'Você ensinou', descarte: 'De um descarte', ajuste: 'De um ajuste', resultado: 'Dos resultados dos posts' }
const inicial = (ativo: boolean, perfil: Record<string, unknown>) => ({
  ligado: ativo, modelo: String(perfil.modelo ?? ''), limite: perfil.limite_mes_creditos != null ? String(perfil.limite_mes_creditos) : '',
  instrucoes: String(perfil.instrucoes ?? ''), economico: perfil.stories_economico !== false,
})

function Quadro({ icone, titulo, acao, children }: { icone: string; titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mk-painel mk-cfg-quadro">
      <header className="mk-cfg-cab"><Icone nome={icone} tam={22} /><h3>{titulo}</h3>{acao && <div className="mk-cfg-acao">{acao}</div>}</header>
      {children}
    </section>
  )
}

function Preferencias({ empresaId, agenteId, perfil }: Pick<Props, 'empresaId' | 'agenteId' | 'perfil'>) {
  const [lista, setLista] = useState<Lembranca[]>(memoriaDe(perfil))
  const [nova, setNova] = useState('')
  const [mostrarCampo, setMostrarCampo] = useState(false)
  const recarregar = async () => {
    const { data } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresaId).eq('agente_id', agenteId).maybeSingle()
    setLista(memoriaDe((data?.perfil ?? {}) as Record<string, unknown>))
  }
  const adicionar = async () => { if (!nova.trim()) return; await lembrar(empresaId, agenteId, nova, 'manual'); setNova(''); recarregar() }
  const apagar = async (texto: string) => { await esquecer(empresaId, agenteId, texto); recarregar() }
  const campoAberto = mostrarCampo || lista.length === 0
  return (
    <Quadro icone="filtro" titulo="Preferências do agente" acao={<button type="button" className="btn btn-contorno-ouro btn-mini" onClick={() => setMostrarCampo(true)}><Icone nome="mais" tam={14} /> Adicionar preferência</button>}>
      {lista.length === 0
        ? <div className="mk-cfg-vazio"><Icone nome="livro" tam={30} /><b>Nenhuma preferência salva.</b><span className="muted pequeno">Ele aprende com os ajustes marcados "Lembrar" e com os motivos de descarte. Você também pode ensinar aqui.</span></div>
        : <ul className="mk-cfg-prefs">{lista.map((m) => (
            <li key={m.texto}><span>{m.texto}<small className="muted">{ORIGEM[m.origem] ?? 'De um ajuste'}</small></span><button type="button" className="btn btn-mini" onClick={() => apagar(m.texto)} aria-label={`Esquecer: ${m.texto}`}><Icone nome="fechar" tam={14} /> Esquecer</button></li>
          ))}</ul>}
      {campoAberto && (
        <div className="mk-cfg-nova">
          <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionar()} placeholder="Ex.: sempre usar 1 emoji no começo da legenda" autoFocus={mostrarCampo} />
          <button type="button" className="btn btn-ouro" disabled={!nova.trim()} onClick={adicionar}>Adicionar</button>
        </div>
      )}
      <p className="muted pequeno">O agente segue estas preferências em todo pedido. Apague o que não valer mais.</p>
    </Quadro>
  )
}

export function ConfigAgente({ empresaId, agenteId, ativo, perfil, aoSalvar }: Props) {
  const [f, setF] = useState(() => inicial(ativo, perfil))
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const mudar = (c: Partial<typeof f>) => { setOk(false); setF((x) => ({ ...x, ...c })) }

  const salvar = async () => {
    setErro(null); setOk(false)
    const v = f.limite.trim()
    const campos = { modelo: f.modelo || null, limite_mes_creditos: v ? Number(v) : null, instrucoes: f.instrucoes.trim() || null, stories_economico: f.economico }
    const { error } = await atualizarPerfil(empresaId, agenteId, (atual) => ({ ...atual, ...campos }), { ativo: f.ligado })
    if (error) return setErro(msgErro(error))
    setOk(true); aoSalvar()
  }

  return (
    <div className="mk-cfg">
      <div className="mk-cfg-grade">
        <Quadro icone="equipe" titulo="Funcionamento" acao={
          <label className={`mk-switch${f.ligado ? ' ligado' : ''}`}><span>{f.ligado ? 'Ligado' : 'Desligado'}</span><input type="checkbox" checked={f.ligado} onChange={(e) => mudar({ ligado: e.target.checked })} /><i /></label>
        }>
          <p className="muted pequeno mk-cfg-status">{f.ligado ? 'Aceita novos pedidos.' : 'Desligado: não aceita pedidos.'}</p>
          <div className="mk-cfg-duas">
            <label>Geração de textos<select value={f.modelo} onChange={(e) => mudar({ modelo: e.target.value })}>
              <option value="">Padrão da empresa</option>{Object.entries(MODELOS).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}
            </select></label>
            <label>Geração de imagens<select disabled value=""><option value="">Ainda não ligada</option></select></label>
          </div>
          <p className="muted pequeno">{f.modelo ? MODELOS[f.modelo]?.dica : 'Modelos e conexões são definidos em Configurações.'} A geração de imagens entra com o Agente de Arte.</p>
          <Link to="/agentes/central" className="link pequeno mk-cfg-link"><Icone nome="equipe" tam={15} /> Abrir configurações gerais</Link>
          <hr />
          <label className="check"><input type="checkbox" checked={f.economico} onChange={(e) => mudar({ economico: e.target.checked })} />
            <span>Usar modo econômico em tarefas compatíveis<small className="muted">Stories saem no modelo econômico, cerca de 20 vezes mais barato. O consumo depende do modelo e do conteúdo gerado.</small></span></label>
        </Quadro>

        <Quadro icone="documento" titulo="Instruções específicas">
          <textarea rows={5} value={f.instrucoes} onChange={(e) => mudar({ instrucoes: e.target.value })} placeholder="Ex.: prefira explicações claras e adapte a chamada para cada canal; reels de até 30 segundos." />
          <p className="muted pequeno">Estas orientações complementam a Base da marca.</p>
          <hr />
          <Link to="/agentes/marca" className="mk-cfg-atalho"><Icone nome="livro" tam={24} /><span><b>Abrir Base da marca ›</b><small className="muted">Público, tom de voz, produtos, redes sociais e regras comuns ficam lá.</small></span></Link>
        </Quadro>

        <CreditosAgente empresa={empresaId} agente={agenteId} limite={f.limite} aoMudarLimite={(limite) => mudar({ limite })} />

        <Preferencias empresaId={empresaId} agenteId={agenteId} perfil={perfil} />
        {agenteId === 'marketing' && <QuadroFluxo empresaId={empresaId} perfil={perfil} aoSalvar={aoSalvar} />}
      </div>

      <Erro msg={erro} />
      <footer className="mk-cfg-rodape">
        <span className="muted pequeno"><Icone nome="info" tam={16} /> As alterações valem para os próximos pedidos.</span>
        {ok && <span className="ok-txt pequeno">Salvo ✓</span>}
        <button type="button" className="btn" onClick={() => { setF(inicial(ativo, perfil)); setErro(null); setOk(false) }}>Cancelar</button>
        <button type="button" className="btn btn-ouro" onClick={salvar}>Salvar configurações</button>
      </footer>
    </div>
  )
}
