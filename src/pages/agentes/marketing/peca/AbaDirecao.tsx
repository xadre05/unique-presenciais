// Aba visual: Direção visual (imagem, carrossel, stories), Gravação e capa (vídeos), Capa (artigo), Diagramação (PDF).
// Estilo, proporção e paleta valem para a peça toda; a orientação pode ser geral ou de um item só.
// À direita, a prévia: o arquivo enviado (ou, quando o Agente de Arte estiver ligado, a arte gerada).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNomesPessoas, usePessoasMarca } from '../../PessoasMarca'
import { EMPRESA } from '../useMarketing'
import { Icone } from '../../../../components/Icone'
import type { Peca, Trabalho } from '../../comum'
import { ESTILOS, PROPORCOES, configDe, nomesItem, type Campo, type CampoTexto } from './editor'
import type { Arte, Cor, Rascunho, Referencia, Visual } from './modelo'
import { CampoEditor } from './CampoEditor'
import { AjusteIA } from './AjusteIA'
import { BotaoEnviar, Miniatura, pastaDa } from './arquivos'
import { AjustarArte, BotaoCriarArte } from './AvisoArte'
import { AjudaOrientacao, EscolhaLogo, ImagensParaUsar } from './ImagensArte'

type Props = {
  peca: Peca; r: Rascunho; mudar: (c: Partial<Rascunho>) => void; atual: number; setAtual: (i: number) => void; nomeAba: string
  rodando: Trabalho | null; ultimo: Trabalho | null; antes: () => Promise<unknown>; aoPedir: () => void
}
const valor = (r: Rascunho, c: CampoTexto) => (c === 'titulo' ? r.titulo : r[c])
const minusc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function Paleta({ cores, mudar }: { cores: Cor[]; mudar: (c: Cor[]) => void }) {
  const troca = (i: number, c: Partial<Cor>) => mudar(cores.map((x, j) => (j === i ? { ...x, ...c } : x)))
  return (
    <div className="pp-paleta">
      {cores.map((c, i) => (
        <span key={i} className="pp-cor">
          <label className="pp-cor-amostra" style={{ background: c.hex }} title="Trocar a cor"><input type="color" value={c.hex} onChange={(e) => troca(i, { hex: e.target.value.toUpperCase() })} /></label>
          <span className="pp-cor-txt"><input value={c.nome} onChange={(e) => troca(i, { nome: e.target.value })} aria-label="Nome da cor" /><small>{c.hex}</small></span>
          {cores.length > 1 && <button type="button" className="pp-cor-tirar" aria-label={`Tirar ${c.nome}`} onClick={() => mudar(cores.filter((_, j) => j !== i))}><Icone nome="fechar" tam={12} /></button>}
        </span>
      ))}
      {cores.length < 6 && <button type="button" className="pp-cor-mais" onClick={() => mudar([...cores, { nome: 'Nova cor', hex: '#888888' }])} aria-label="Adicionar cor"><Icone nome="mais" tam={16} /></button>}
    </div>
  )
}

function Previa({ peca, r, mudar, atual, setAtual }: Pick<Props, 'peca' | 'r' | 'mudar' | 'atual' | 'setAtual'>) {
  const cfg = configDe(peca.tipo)
  const porItem = cfg.artes === 'por_item'
  const total = porItem ? r.itens.length : 1
  const i = porItem ? Math.min(atual, Math.max(0, total - 1)) : 0
  const arte: Arte = r.artes[i] ?? {}
  const prontas = Array.from({ length: total }, (_, j) => !!r.artes[j]?.arquivo).filter(Boolean).length
  const { singular } = nomesItem(peca.tipo)
  const nome = porItem ? `${singular} ${i + 1}` : cfg.rotuloArte
  const guardar = (a: Arte) => mudar({ artes: Array.from({ length: Math.max(total, r.artes.length) }, (_, j) => (j === i ? a : r.artes[j] ?? {})) })
  return (
    <aside className="pp-previa">
      <header><b>Prévia · {nome}</b>{arte.arquivo && <span className="pp-selo ok">{(arte as { gerada?: boolean }).gerada ? 'Gerada pela IA' : 'Arquivo enviado'}</span>}</header>
      <div className={`pp-previa-quadro p-${r.visual.proporcao.replace(':', '-')}`}>
        {arte.arquivo ? <Miniatura caminho={arte.arquivo} nome={arte.nome} /> : <span className="muted"><Icone nome="imagem" tam={34} />{cfg.etapa2?.arquivos === false ? `${cfg.rotuloArte} (opcional)` : `${cfg.rotuloArte} ainda não criada`}<small>{r.visual.proporcao}</small></span>}
      </div>
      <div className="pp-previa-botoes">
        <BotaoCriarArte item={porItem ? i : null} texto={arte.arquivo ? 'Gerar outra arte' : `Gerar ${porItem ? `arte desta ${minusc(singular)}` : minusc(cfg.rotuloArte)}`} />
        <BotaoEnviar pasta={pastaDa(peca.id)} texto={cfg.etapa2?.arquivos === false ? 'Enviar arquivo' : 'Enviar arte pronta'} aoEnviar={(caminho, n) => guardar({ ...arte, arquivo: caminho, nome: n })} />
        {arte.arquivo && <button className="btn btn-mini" onClick={() => guardar({ ...arte, arquivo: undefined, nome: undefined })}>Tirar arquivo</button>}
      </div>
      {arte.arquivo && <AjustarArte item={porItem ? i : null} />}
      <span className="muted pequeno">A arte segue o texto {porItem ? `desta ${minusc(singular)}` : 'da peça'}, a Direção visual e quem aparece. Feita fora do sistema? Envie a arte pronta.</span>
      {porItem && total > 0 && (
        <div className="pp-numeros">
          <span className="muted pequeno">{prontas} de {total} artes prontas</span>
          <div>{Array.from({ length: total }, (_, j) => <button key={j} type="button" className={`${j === i ? 'ativo' : ''}${r.artes[j]?.arquivo ? ' pronto' : ''}`} onClick={() => setAtual(j)}>{j + 1}</button>)}</div>
        </div>
      )}
    </aside>
  )
}

// pessoas da marca (cadastradas na Base da marca, com autorização) que aparecem na arte
function QuemAparece({ v, muda }: { v: Visual; muda: (c: Partial<Visual>) => void }) {
  const pessoas = usePessoasMarca(EMPRESA).dados ?? []
  const prontas = pessoas.filter((p) => p.autorizado && p.fotos.length)
  const marcadas = v.pessoas ?? []
  const trocar = (id: string) => muda({ pessoas: marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id] })
  return (
    <div className="pp-campo">
      <span className="pp-rotulo">Quem aparece nesta arte?</span>
      <div className="pp-pessoas">
        <button type="button" className={!marcadas.length ? 'ativo' : ''} onClick={() => muda({ pessoas: [] })}>Ninguém</button>
        {prontas.map((p) => <button key={p.id} type="button" className={marcadas.includes(p.id) ? 'ativo' : ''} onClick={() => trocar(p.id)}>{p.nome}</button>)}
      </div>
      <span className="muted pequeno">{prontas.length ? 'A IA usa as fotos cadastradas como referência do rosto.' : <>Cadastre as pessoas e as fotos em <Link to="/agentes/marca" className="link">Base da marca → Pessoas da marca</Link>.</>}</span>
    </div>
  )
}

// fotos reais de antes e depois do paciente; o envio só abre depois de confirmar a autorização
function AntesDepois({ peca, v, muda }: { peca: Peca; v: Visual; muda: (c: Partial<Visual>) => void }) {
  const fotos = v.antesDepois ?? []
  return (
    <div className="pp-campo">
      <span className="pp-rotulo">Fotos de antes e depois</span>
      <label className="pp-check"><input type="checkbox" checked={!!v.autorizado} onChange={(e) => muda({ autorizado: e.target.checked })} /> O paciente autorizou o uso destas fotos (termo assinado)</label>
      <div className="pp-refs">
        {fotos.map((x, j) => (
          <span key={x.caminho} className="pp-ref"><Miniatura caminho={x.caminho} nome={x.nome} /><button type="button" className="pp-cor-tirar" aria-label={`Tirar ${x.nome}`} onClick={() => muda({ antesDepois: fotos.filter((_, k) => k !== j) })}><Icone nome="fechar" tam={12} /></button></span>
        ))}
        <BotaoEnviar pasta={pastaDa(peca.id)} texto="Enviar foto" classe="btn btn-contorno btn-mini" aceita="image/*" desligado={!v.autorizado} aoEnviar={(caminho, nome) => muda({ antesDepois: [...fotos, { caminho, nome }] })} />
      </div>
      <span className="muted pequeno">Só fotos reais. A IA monta a arte com elas, mas não cria nem altera o resultado do paciente.</span>
    </div>
  )
}

export function AbaDirecao({ peca, r, mudar, atual, setAtual, nomeAba, rodando, ultimo, antes, aoPedir }: Props) {
  const cfg = configDe(peca.tipo)
  const porItem = cfg.artes === 'por_item'
  const { singular, plural } = nomesItem(peca.tipo)
  const [especifica, setEspecifica] = useState(false)
  const v = r.visual
  const muda = (c: Partial<Visual>) => mudar({ visual: { ...v, ...c } })
  const i = Math.min(atual, Math.max(0, r.itens.length - 1))
  const mudaArte = (c: Partial<Arte>) => mudar({ artes: Array.from({ length: Math.max(r.itens.length, r.artes.length) }, (_, j) => (j === i ? { ...r.artes[j], ...c } : r.artes[j] ?? {})) })
  const orientaItem = (orientacao: string) => mudaArte({ orientacao })
  const elementosItem = (elementos: Referencia[]) => mudaArte({ elementos })
  const campos: Campo[] = cfg.visual
  const nomesPessoas = useNomesPessoas(EMPRESA, v.pessoas ?? [])
  const so = `Ajuste SOMENTE a parte visual (${campos.map((c) => `${c.rotulo}: campo ${c.campo}`).join('; ')}).`
  return (
    <div className="pp-direcao">
      <div className="pp-direcao-form">
        {porItem && (
          <div className="pp-segmento" role="tablist">
            <button role="tab" aria-selected={!especifica} className={!especifica ? 'ativo' : ''} onClick={() => setEspecifica(false)}>Todas as {minusc(plural)}</button>
            <button role="tab" aria-selected={especifica} className={especifica ? 'ativo' : ''} onClick={() => setEspecifica(true)}>{singular} específica</button>
          </div>
        )}
        <div className="pp-duas">
          <label className="pp-campo"><span className="pp-rotulo">Estilo</span><span className="select-icone"><select value={v.estilo} onChange={(e) => muda({ estilo: e.target.value })}>{[...new Set([v.estilo, ...ESTILOS])].map((s) => <option key={s}>{s}</option>)}</select></span></label>
          <label className="pp-campo"><span className="pp-rotulo">Proporção</span><span className="select-icone"><select value={v.proporcao} onChange={(e) => muda({ proporcao: e.target.value })}>{[...new Set([v.proporcao, ...PROPORCOES])].map((s) => <option key={s}>{s}</option>)}</select></span></label>
        </div>
        <div className="pp-campo"><span className="pp-rotulo">Paleta de cores</span><Paleta cores={v.paleta} mudar={(paleta) => muda({ paleta })} /></div>
        {cfg.artes && <EscolhaLogo v={v} muda={muda} />}
        {especifica && porItem
          ? <>
              <CampoEditor id="arte-item" rotulo={`Orientação para a arte da ${minusc(singular)} ${i + 1}`} valor={r.artes[i]?.orientacao ?? ''} mudar={orientaItem} linhas={4}
                dica={`Só para esta ${minusc(singular)}. Troque o número na prévia ao lado.`} placeholder="Ex.: fundo escuro e o preço em dourado, com bastante respiro" />
              <AjudaOrientacao valor={r.artes[i]?.orientacao ?? ''} mudar={orientaItem} pessoas={nomesPessoas} imagens={(r.artes[i]?.elementos ?? []).map((x) => x.nome)} />
              <ImagensParaUsar pecaId={peca.id} lista={r.artes[i]?.elementos ?? []} mudar={elementosItem} onde={`na ${minusc(singular)} ${i + 1}`} />
            </>
          : campos.map((c) => (
            <div key={c.campo}>
              <CampoEditor id={`visual-${c.campo}`} rotulo={c.rotulo} valor={valor(r, c.campo)} mudar={(x) => mudar({ [c.campo]: x })} max={c.max} linhas={c.linhas} dica={c.dica} />
              {c.campo === 'prompt_imagem' && cfg.artes && <AjudaOrientacao valor={r.prompt_imagem} mudar={(x) => mudar({ prompt_imagem: x })} pessoas={nomesPessoas} imagens={(v.elementos ?? []).map((x) => x.nome)} />}
            </div>
          ))}
        {cfg.artes && !porItem && <ImagensParaUsar pecaId={peca.id} lista={v.elementos ?? []} mudar={(elementos) => muda({ elementos })} onde="na arte" />}
        <div className="pp-campo">
          <span className="pp-rotulo">Referências visuais</span>
          <div className="pp-refs">
            {v.referencias.map((x, j) => (
              <span key={x.caminho} className="pp-ref"><Miniatura caminho={x.caminho} nome={x.nome} /><button type="button" className="pp-cor-tirar" aria-label={`Tirar ${x.nome}`} onClick={() => muda({ referencias: v.referencias.filter((_, k) => k !== j) })}><Icone nome="fechar" tam={12} /></button></span>
            ))}
            <BotaoEnviar pasta={pastaDa(peca.id)} texto="Enviar referência" classe="btn btn-contorno btn-mini" aceita="image/*" aoEnviar={(caminho, nome) => muda({ referencias: [...v.referencias, { caminho, nome }] })} />
          </div>
          <span className="muted pequeno">Só inspiram o estilo (a IA não copia). Para uma imagem aparecer na arte, use "Imagens para usar".</span>
        </div>
        <QuemAparece v={v} muda={muda} />
        <AntesDepois peca={peca} v={v} muda={muda} />
        <AjusteIA peca={peca} rodando={rodando} ultimo={ultimo} titulo={`O que deseja ajustar em ${minusc(nomeAba)}?`} placeholder="Ex.: menos texto na arte e mais contraste no título"
          alcances={[{ id: 'visual', nome: nomeAba, instrucao: (p) => `${so} Pedido: ${p}. Mantenha o texto, o roteiro e a legenda exatamente como estão.` }, { id: 'peca', nome: 'Peça inteira', instrucao: (p) => p }]}
          antes={antes} aoPedir={aoPedir} />
      </div>
      {cfg.artes && <Previa peca={peca} r={r} mudar={mudar} atual={atual} setAtual={setAtual} />}
    </div>
  )
}
