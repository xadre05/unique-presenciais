// Ata da Reunião de pauta: o que foi combinado (período, objetivo, canais e quantidade, assuntos com o porquê,
// o que evitar). O agente atualiza a cada resposta e a equipe corrige aqui. "Montar o plano" só libera com a ata completa.
import { Icone } from '../../../../components/Icone'
import { REDES, nomeFormato, type Rede } from '../redes'
import { LogoRede } from '../LogoRede'
import { ataCompleta, totalDa, type Ata } from './dados'

const dm = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const nomeRede = (r: string) => REDES[r as Rede]?.nome ?? r

type Props = { ata: Ata; pronta: boolean; editavel: boolean; montando?: boolean; aoMudar: (a: Ata) => void; aoMontar?: () => void; aoReabrir?: () => void }

function faltando(a: Ata) {
  const f: string[] = []
  if (!a.canais?.some((c) => c.formatos?.length)) f.push('canais e formatos')
  if (!a.assuntos?.length) f.push('assuntos')
  return f
}

export function AtaReuniao({ ata, pronta, editavel, montando, aoMudar, aoMontar, aoReabrir }: Props) {
  const mudar = (c: Partial<Ata>) => aoMudar({ ...ata, ...c })
  const vazia = !ata.objetivo && !ata.canais?.length && !ata.assuntos?.length
  const falta = faltando(ata)
  return (
    <section className="mk-proposta reu-ata">
      <div className="mk-proposta-topo">
        <span className="mk-etiqueta">{editavel ? (pronta && !falta.length ? 'Pronta para montar o plano' : 'Ata em construção') : 'Ata da reunião'}</span>
        <span className="pequeno muted"><Icone nome="info" tam={13} /> {editavel ? 'O agente atualiza a cada resposta; você pode corrigir.' : 'O que foi combinado na reunião.'}</span>
      </div>
      <h4><Icone nome="documento" tam={20} /> Ata · {dm(ata.inicio)} a {dm(ata.fim)}</h4>
      {vazia && <p className="muted pequeno">A ata vai se montando com o que vocês combinarem na conversa.</p>}
      <dl className="mk-detalhes">
        <dt>Objetivo</dt><dd>{editavel ? <input value={ata.objetivo ?? ''} onChange={(e) => mudar({ objetivo: e.target.value })} placeholder="Combinado na conversa" /> : ata.objetivo || '—'}</dd>
        <dt>Público</dt><dd>{editavel ? <input value={ata.publico ?? ''} onChange={(e) => mudar({ publico: e.target.value })} placeholder="Combinado na conversa" /> : ata.publico || '—'}</dd>
        {ata.campanha && <><dt>Campanha</dt><dd>{ata.campanha}</dd></>}
        <dt>Canais</dt>
        <dd>{ata.canais?.length ? <ul className="reu-canais">{ata.canais.map((c, i) => (
          <li key={i} style={{ ['--cor-rede' as string]: REDES[c.rede as Rede]?.cor }}>
            <LogoRede rede={c.rede as Rede} tam={15} /><span><b>{nomeRede(c.rede)}</b> · {c.formatos.map((f) => nomeFormato(f, c.rede as Rede)).join(', ')}</span>
            {editavel ? <input type="number" min={0} max={40} value={c.quantidade} aria-label={`Peças no ${nomeRede(c.rede)}`} onChange={(e) => mudar({ total: undefined, canais: ata.canais!.map((x, j) => (j === i ? { ...x, quantidade: Math.max(0, Number(e.target.value)) } : x)) })} /> : <span>{c.quantidade}</span>}
            <small>peças</small>
            {editavel && <button type="button" className="reu-tirar" aria-label="Tirar canal" onClick={() => mudar({ total: undefined, canais: ata.canais!.filter((_, j) => j !== i) })}><Icone nome="fechar" tam={13} /></button>}
          </li>))}</ul> : <span className="muted">—</span>}</dd>
        <dt>Total</dt><dd>{ata.canais?.length ? `${totalDa(ata)} peça(s)` : '—'}</dd>
      </dl>
      <h5 className="reu-subtitulo">Assuntos e por quê</h5>
      {ata.assuntos?.length ? <ol className="reu-assuntos">{ata.assuntos.map((s, i) => (
        <li key={i}>
          <span><b>{s.tema}</b>{s.porque && <small>Por quê: {s.porque}</small>}{(s.rede || s.tipo || s.dia) && <small className="muted">{[s.rede && nomeRede(s.rede), s.tipo && nomeFormato(s.tipo, (s.rede ?? 'instagram') as Rede), s.dia && dm(s.dia)].filter(Boolean).join(' · ')}</small>}</span>
          {editavel && <button type="button" className="reu-tirar" aria-label="Tirar assunto" onClick={() => mudar({ assuntos: ata.assuntos!.filter((_, j) => j !== i) })}><Icone nome="fechar" tam={13} /></button>}
        </li>))}</ol> : <p className="muted pequeno">Nenhum assunto combinado ainda.</p>}
      {!!ata.evitar?.length && <><h5 className="reu-subtitulo">Evitar</h5><div className="mk-chips">{ata.evitar.map((x, i) => <span key={i} className="mk-chip">{x}{editavel && <button type="button" className="reu-tirar" aria-label="Tirar" onClick={() => mudar({ evitar: ata.evitar!.filter((_, j) => j !== i) })}><Icone nome="fechar" tam={12} /></button>}</span>)}</div></>}
      {ata.observacoes && <p className="pequeno"><b>Observações:</b> {ata.observacoes}</p>}
      {editavel && aoMontar && (
        <footer className="reu-ata-rodape">
          {falta.length > 0 && <span className="pequeno muted">Falta combinar: {falta.join(' e ')}.</span>}
          <button className="btn btn-ouro" disabled={montando || !ataCompleta(ata)} onClick={aoMontar}><Icone nome="agenda" tam={16} /> {montando ? 'Montando…' : 'Montar o plano'}</button>
          <span className="pequeno muted">Só aqui o agente monta o calendário. Os textos e as artes vêm depois, com a sua aprovação.</span>
        </footer>
      )}
      {!editavel && aoReabrir && <button type="button" className="btn btn-contorno-ouro" onClick={aoReabrir}><Icone nome="mensagem" tam={16} /> Voltar à conversa</button>}
    </section>
  )
}
