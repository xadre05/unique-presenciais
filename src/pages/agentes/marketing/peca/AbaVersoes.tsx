// Aba Versões: histórico (cada escrita do agente ou sessão de edição da equipe é uma versão) e comparação
// campo a campo entre duas versões. Restaurar fica no rodapé e cria uma versão nova, sem apagar o histórico.
import { useMemo, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { configDe } from './editor'
import { diferencas, type Grupo } from './diferencas'
import type { Versao } from './modelo'

export const ORIGEM: Record<Versao['origem'], string> = { ia: 'Gerada pela IA', ajuste_ia: 'Ajuste com IA', manual: 'Editada pela equipe', restaurada: 'Restaurada', atual: 'Versão atual' }
export const seloDe = (v: Versao) => (v.aprovada ? 'Texto aprovado' : v.n === 1 && v.origem === 'ia' ? 'Rascunho inicial' : ORIGEM[v.origem])

export function quando(iso: string | null) {
  if (!iso) return 'Antes do histórico'
  const d = new Date(iso), hoje = new Date()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dias = Math.round((new Date(hoje.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000)
  return dias === 0 ? `Hoje, ${hora}` : dias === 1 ? `Ontem, ${hora}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`
}

type Props = { tipo: string; versoes: Versao[]; sel: number; setSel: (n: number) => void }

function Historico({ tipo, versoes, sel, setSel }: Props) {
  const abas = configDe(tipo).abas.filter((a) => a.id !== 'versoes')
  const [filtro, setFiltro] = useState<Grupo | ''>('')
  const atual = versoes.at(-1)?.n
  const lista = [...versoes].reverse().filter((v) => {
    if (!filtro) return true
    const i = versoes.indexOf(v)
    return i > 0 && diferencas(versoes[i - 1].dados, v.dados).some((d) => d.grupo === filtro)
  })
  return (
    <section className="pp-hist">
      <h3>Histórico de versões</h3>
      <span className="select-icone"><select value={filtro} onChange={(e) => setFiltro(e.target.value as Grupo | '')} aria-label="Filtrar versões">
        <option value="">Toda a peça</option>{abas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></span>
      <ol>
        {lista.map((v) => (
          <li key={v.n}>
            <button type="button" className={`pp-versao${v.n === sel ? ' ativa' : ''}`} onClick={() => setSel(v.n)}>
              <span className="pp-versao-topo"><b>v{v.n}</b>{v.n === atual && <span className="pp-selo ok">Atual</span>}</span>
              <span className="muted pequeno">{quando(v.em)} · {v.por}</span>
              <span>{v.nota}</span>
              <span className={`pp-selo${v.aprovada ? ' ok' : ''}`}>{seloDe(v)}</span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="muted pequeno">Nenhuma versão mudou esta parte.</li>}
      </ol>
      <p className="muted pequeno"><Icone nome="info" tam={14} /> Cada versão guarda o conteúdo e os arquivos daquele momento.</p>
    </section>
  )
}

function Comparar({ tipo, versoes, sel, setSel }: Props) {
  const cfg = configDe(tipo)
  const ultima = versoes.at(-1)!
  const [b, setB] = useState(ultima.n)
  const [aba, setAba] = useState<Grupo | 'resumo'>('resumo')
  const va = versoes.find((v) => v.n === sel) ?? versoes[0], vb = versoes.find((v) => v.n === b) ?? ultima
  const difs = useMemo(() => diferencas(va.dados, vb.dados), [va, vb])
  const vistas = difs.filter((d) => (aba === 'resumo' ? true : d.grupo === aba))
  const campos = difs.filter((d) => d.grupo !== 'arquivos').length, arquivos = difs.length - campos
  const opcoes = versoes.map((v) => <option key={v.n} value={v.n}>Versão {v.n}{v.n === ultima.n ? ' · Atual' : ''}</option>)
  const abas: { id: Grupo | 'resumo'; nome: string }[] = [{ id: 'resumo', nome: 'Resumo' }, ...cfg.abas.filter((a) => a.id !== 'versoes').map((a) => ({ id: a.id as Grupo, nome: a.nome })), ...(cfg.artes ? [{ id: 'arquivos' as Grupo, nome: 'Arquivos' }] : [])]
  const titulo = (v: Versao, papel: string) => `Versão ${v.n} · ${v.n === ultima.n ? 'Atual' : papel}`
  return (
    <section className="pp-comparar">
      <h3>Comparar versões</h3>
      <div className="pp-comparar-sel">
        <span className="select-icone"><select value={va.n} onChange={(e) => setSel(Number(e.target.value))} aria-label="Versão da esquerda">{opcoes}</select></span>
        <button type="button" className="btn btn-quadrado" aria-label="Inverter" onClick={() => { setSel(vb.n); setB(va.n) }}><Icone nome="trocar" /></button>
        <span className="select-icone"><select value={vb.n} onChange={(e) => setB(Number(e.target.value))} aria-label="Versão da direita">{opcoes}</select></span>
      </div>
      <nav className="pp-subabas">{abas.map((x) => <button key={x.id} className={aba === x.id ? 'ativa' : ''} onClick={() => setAba(x.id)}>{x.nome}</button>)}</nav>
      <div className="pp-contagens">
        <span className={`pp-contagem${campos ? ' tem' : ''}`}><Icone nome="info" tam={15} /> {campos} {campos === 1 ? 'campo alterado' : 'campos alterados'}</span>
        {cfg.artes && <span className={`pp-contagem${arquivos ? ' tem' : ''}`}><Icone nome="info" tam={15} /> {arquivos} {arquivos === 1 ? 'arquivo alterado' : 'arquivos alterados'}</span>}
      </div>
      {va.n === vb.n ? <p className="muted">Escolha duas versões diferentes para comparar.</p> : (
        <div className="pp-tabela-dif">
          <div className="pp-dif-cab"><span><b>{titulo(va, 'Selecionada')}</b>{va.n !== ultima.n && <small>Conteúdo apenas para consulta</small>}</span><span><b>{titulo(vb, 'Comparada')}</b></span></div>
          {vistas.map((d, k) => (
            <div key={k} className="pp-dif">
              <span className="pp-dif-rotulo">{d.rotulo}</span>
              <div className="pp-dif-par"><p className="antes">{d.antes || <i>vazio</i>}</p><p className="depois">{d.depois || <i>vazio</i>}</p></div>
            </div>
          ))}
          {!vistas.length && <p className="muted pp-dif-nada">Nada mudou {aba === 'resumo' ? 'entre as duas versões' : 'nesta parte'}.</p>}
        </div>
      )}
      {va.n !== vb.n && !!vistas.length && <p className="pp-nota-dif muted pequeno"><Icone nome="info" tam={14} /> {aba === 'resumo' ? 'O restante da peça permanece igual.' : 'O que não aparece aqui permanece igual.'}</p>}
    </section>
  )
}

export function AbaVersoes(p: Props) {
  if (p.versoes.length < 2) return (
    <div className="pp-vazio"><Icone nome="historico" tam={28} />
      <p>{p.versoes.length ? 'Só existe uma versão desta peça.' : 'Ainda não há versões.'}</p>
      <span className="muted pequeno">Cada ajuste do agente e cada sessão de edição da equipe cria uma versão nova. Aqui você compara e restaura.</span></div>
  )
  return <div className="pp-versoes"><Historico {...p} /><Comparar key={p.versoes.length} {...p} /></div>
}
