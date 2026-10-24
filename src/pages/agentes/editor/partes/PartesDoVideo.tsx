// Vídeo gravado em partes (etapa "Vídeo" do Estúdio): o agente ouve cada parte e propõe a ordem (e o que deixar de
// fora, como uma tomada repetida); a pessoa confere, muda a ordem se quiser e junta. O vídeo juntado segue para a
// edição normal, com a fala já transcrita (não lê o áudio de novo).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import type { ArquivoBruto, Edicao } from '../../marketing/edicao/dados'
import type { Palavra } from '../../marketing/edicao/linhaTempo'
import { juntarVideos } from './juntar'
import { CombinarCriativos } from './CombinarCriativos'
import { falaDa, infoDa, juntarPalavras, lerParte, marcarRegravacoes, nomeDoJuntado, ordemGuardada, pedirOrdem, type Papel, type Parte } from './dados'

export type Juntado = { arquivo: File; palavras: Palavra[]; partes: ArquivoBruto[]; duracao: number }
type Props = { peca: Peca; arquivos: File[]; edicao: Edicao; aoJuntar: (j: Juntado) => Promise<void>; aoCancelar: () => void }

const NOME_PAPEL: Record<Papel, string> = { gancho: 'Abertura', corpo: 'Conteúdo', chamada: 'Chamada final', completo: 'Completo', regravacao: 'Regravação de trecho' }
const tempo = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')
const trecho = (p: Parte) => { const f = falaDa(p); return f.length > 160 ? `${f.slice(0, 160)}…` : f }
const mover = (lista: number[], de: number, para: number) => { const n = [...lista]; const [x] = n.splice(de, 1); n.splice(para, 0, x); return n }

export function PartesDoVideo({ peca, arquivos, edicao, aoJuntar, aoCancelar }: Props) {
  const roteiro = ((peca.conteudo.roteiro ?? []) as string[]).join('\n\n')
  const [guardada] = useState(() => ordemGuardada(edicao.partes, arquivos))
  const [partes, setPartes] = useState<Parte[]>(() => arquivos.map((arquivo) => ({ arquivo })))
  const [ordem, setOrdem] = useState<number[]>(() => guardada ?? arquivos.map((_, k) => k))
  const [explicacao, setExplicacao] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const iniciou = useRef(false)

  const executar = async (fazer: () => Promise<void>) => {
    setErro(null)
    try { await fazer() } catch (e) { setErro(e instanceof Error ? e.message : 'Algo deu errado.') } finally { setOcupado(null) }
  }
  // ouve (transcreve) as partes que ainda não foram ouvidas
  const ouvir = async (lista: Parte[], indices: number[]) => {
    const nova = [...lista]
    for (const k of indices) {
      if (nova[k].palavras) continue
      setOcupado(`Ouvindo a parte ${k + 1} de ${nova.length}…`)
      nova[k] = await lerParte(peca.id, nova[k]); setPartes([...nova])
    }
    return nova
  }
  const organizar = () => executar(async () => {
    const lidas = await ouvir(partes, partes.map((_, k) => k))
    setOcupado('O agente está colocando as partes na ordem…')
    const r = await pedirOrdem(peca.id, lidas, roteiro)
    const papel = new Map(r.papeis.map((x) => [x.parte, x.papel])), fora = new Map(r.descartar.map((x) => [x.parte, x.motivo]))
    const marcadas = lidas.map((p, k) => ({ ...p, papel: papel.get(k + 1), fora: fora.get(k + 1) }))
    // trecho regravado nunca fica de fora: entra depois do vídeo completo e o agente escolhe a melhor versão ao editar
    const reg = marcarRegravacoes(marcadas, r.ordem.map((n) => n - 1).filter((k) => !fora.has(k + 1)))
    setPartes(reg.partes); setOrdem(reg.ordem)
    setExplicacao(reg.achadas.length
      ? `${reg.achadas.map((k) => `"${lidas[k].arquivo.name}"`).join(' e ')} ${reg.achadas.length > 1 ? 'são trechos regravados' : 'é um trecho regravado'} do vídeo completo. ${reg.achadas.length > 1 ? 'Entram' : 'Entra'} no final, e na edição o agente compara cada trecho com a versão do vídeo completo e fica com a melhor (luz, expressão e fala).`
      : r.explicacao)
  })
  // partes já juntadas antes na mesma ordem: só junta de novo (sem ouvir nem perguntar ao agente)
  useEffect(() => { if (!iniciou.current && !guardada) { iniciou.current = true; void organizar() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const juntar = () => executar(async () => {
    const reaproveita = !!guardada && !!edicao.palavras?.length && ordem.join() === guardada.join()
    const lidas = reaproveita ? partes : await ouvir(partes, ordem)
    const escolhidas = ordem.map((k) => lidas[k])
    let arquivo = escolhidas[0].arquivo, duracoes = [escolhidas[0].duracao ?? edicao.arquivo?.duracao ?? 0]
    if (escolhidas.length > 1) {
      setOcupado('Juntando as partes…')
      const r = await juntarVideos(escolhidas.map((p) => p.arquivo), nomeDoJuntado(peca.titulo), (fr, texto) => setOcupado(`${texto ?? 'Juntando as partes…'} ${Math.round(fr * 100)}%`))
      arquivo = r.arquivo; duracoes = r.duracoes
    }
    const palavras = reaproveita ? edicao.palavras! : juntarPalavras(escolhidas, duracoes)
    if (!palavras.length) throw new Error('Não encontrei fala nas partes escolhidas.')
    setOcupado('Guardando…')
    await aoJuntar({ arquivo, palavras, partes: escolhidas.map((p, k) => ({ ...infoDa(p), duracao: duracoes[k] })), duracao: duracoes.reduce((s, d) => s + d, 0) })
  })

  const mudarPapel = (k: number, papel: Papel | '') => setPartes((ps) => ps.map((p, i) => (i === k ? { ...p, papel: papel || undefined } : p)))
  const tirar = (k: number) => setOrdem((o) => o.filter((x) => x !== k))
  const voltar = (k: number) => setOrdem((o) => [...o, k])
  const foraDoVideo = partes.map((_, k) => k).filter((k) => !ordem.includes(k))

  return (
    <section className="ev-passo pt-partes">
      <h4><span>1</span> Vídeo gravado em {arquivos.length} partes</h4>
      <p className="muted pequeno">{guardada ? 'São as mesmas partes da última vez: é só juntar de novo.' : 'O agente ouve cada parte e, pela fala e pelo roteiro (etapa Conteúdo), propõe a ordem. Confira e mude se quiser.'}</p>
      {explicacao && <p className="pt-explicacao pequeno"><Icone nome="floco" tam={14} /> {explicacao}</p>}
      <ol className="pt-lista">
        {ordem.map((k, pos) => <LinhaParte key={k} parte={partes[k]} numero={pos + 1} aoPapel={(p) => mudarPapel(k, p)}
          acoes={<>
            <button type="button" className="btn-icone" title="Subir" disabled={!!ocupado || pos === 0} onClick={() => setOrdem((o) => mover(o, pos, pos - 1))}><Icone nome="cima" tam={15} /></button>
            <button type="button" className="btn-icone" title="Descer" disabled={!!ocupado || pos === ordem.length - 1} onClick={() => setOrdem((o) => mover(o, pos, pos + 1))}><Icone nome="baixo" tam={15} /></button>
            <button type="button" className="btn-icone" title="Deixar fora do vídeo" disabled={!!ocupado || ordem.length === 1} onClick={() => tirar(k)}><Icone nome="lixeira" tam={15} /></button>
          </>} />)}
      </ol>
      {foraDoVideo.length > 0 && <>
        <p className="pequeno muted">Fora do vídeo</p>
        <ul className="pt-lista pt-fora">
          {foraDoVideo.map((k) => <LinhaParte key={k} parte={partes[k]} aoPapel={(p) => mudarPapel(k, p)}
            acoes={<button type="button" className="link pequeno" disabled={!!ocupado} onClick={() => voltar(k)}>Pôr no vídeo</button>} />)}
        </ul>
      </>}
      <CombinarCriativos peca={peca} partes={partes} ordem={ordem} ocupado={!!ocupado} ouvirTodas={async () => { try { return await ouvir(partes, partes.map((_, k) => k)) } finally { setOcupado(null) } }} />
      {ocupado && <p className="pequeno pt-ocupado">{ocupado}</p>}
      {erro && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> {erro}</p>}
      <div className="ev-escolha">
        <button type="button" className="btn btn-ouro" disabled={!!ocupado || !ordem.length} onClick={juntar}><Icone nome="video" tam={15} /> {ordem.length === 1 ? 'Usar este vídeo e continuar' : 'Juntar e continuar'}</button>
        {(guardada || erro) && <button type="button" className="btn btn-contorno-ouro" disabled={!!ocupado} onClick={organizar}><Icone nome="floco" tam={15} /> O agente organiza</button>}
        <button type="button" className="link pequeno" disabled={!!ocupado} onClick={aoCancelar}>Escolher outros arquivos</button>
      </div>
    </section>
  )
}

function LinhaParte({ parte, numero, acoes, aoPapel }: { parte: Parte; numero?: number; acoes: ReactNode; aoPapel: (p: Papel | '') => void }) {
  return (
    <li className="pt-parte">
      <div className="pt-cabeca">
        {numero && <b>{numero}º</b>} <span>{parte.arquivo.name}</span> <span className="muted pequeno">{tempo(parte.duracao)}</span>
        {/* o papel (abertura, conteúdo, final) vem do agente; dá para corrigir aqui */}
        <select className="pt-papel" value={parte.papel ?? ''} onChange={(e) => aoPapel(e.target.value as Papel | '')} aria-label="O que é esta parte">
          <option value="">sem papel</option>{(Object.keys(NOME_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{NOME_PAPEL[p]}</option>)}
        </select>
        <span className="pt-acoes">{acoes}</span>
      </div>
      {parte.palavras && <p className="pequeno pt-fala">“{trecho(parte) || 'sem fala'}”</p>}
      {parte.fora && <p className="pequeno muted">O agente deixou de fora: {parte.fora}</p>}
    </li>
  )
}
