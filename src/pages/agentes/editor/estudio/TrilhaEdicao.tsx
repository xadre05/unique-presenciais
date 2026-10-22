// Linha do tempo do Estúdio (só leitura): o que o agente montou, no tempo do vídeo editado. Cortes (cada trecho que
// ficou), imagens por cima da fala, textos na tela e efeitos sonoros, com a agulha acompanhando a prévia.
import { tempoFinal, type Intervalo, type LinhaTempo } from '../../marketing/edicao/linhaTempo'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function TrilhaEdicao({ linha, agora }: { linha: LinhaTempo; agora: number }) {
  const d = linha.duracao || 1
  const pos = (t: number) => `${(tempoFinal(t, linha.trechos) / d) * 100}%`
  const larg = (i: Intervalo) => `${Math.max(0.6, ((tempoFinal(i.fim, linha.trechos) - tempoFinal(i.ini, linha.trechos)) / d) * 100)}%`
  const marcas = Array.from({ length: Math.floor(d / 10) + 1 }, (_, k) => k * 10)
  let acumulado = 0
  return (
    <div className="es-trilha" aria-label="Linha do tempo da edição">
      <div className="es-trilha-regua">{marcas.map((m) => <span key={m} style={{ left: `${(m / d) * 100}%` }}>{mmss(m)}</span>)}</div>
      {linha.beats.length > 0 && <div className="es-faixa"><span className="es-faixa-nome">Beats</span><div className="es-faixa-corpo">
        {linha.beats.map((b, k) => <i key={k} className={`es-bloco beat beat-${b.nome}`} style={{ left: pos(b.ini), width: larg(b) }} title={b.tratamento}>{b.nome}</i>)}
      </div></div>}
      <div className="es-faixa"><span className="es-faixa-nome">Cortes</span><div className="es-faixa-corpo">
        {linha.trechos.map((t, k) => { const ini = acumulado; acumulado += t.fim - t.ini; return <i key={k} className="es-bloco corte" style={{ left: `${(ini / d) * 100}%`, width: `${((t.fim - t.ini) / d) * 100}%` }} /> })}
      </div></div>
      <div className="es-faixa"><span className="es-faixa-nome">Imagens</span><div className="es-faixa-corpo">
        {linha.coberturas.map((c, k) => <i key={k} className={`es-bloco imagem ${c.layout}`} style={{ left: pos(c.ini), width: larg(c) }} title={`Mídia ${c.midia + 1} · ${c.layout}`} />)}
        {linha.cenas.map((c, k) => <i key={`c${k}`} className="es-bloco cena" style={{ left: pos(c.ini), width: larg(c) }} title="Cena animada">✦</i>)}
      </div></div>
      <div className="es-faixa"><span className="es-faixa-nome">Texto</span><div className="es-faixa-corpo">
        {linha.textos.map((x, k) => <i key={k} className="es-bloco texto" style={{ left: pos(x.ini), width: larg(x) }} title={x.texto}>{x.texto}</i>)}
      </div></div>
      <div className="es-faixa"><span className="es-faixa-nome">Efeitos</span><div className="es-faixa-corpo">
        {linha.efeitos.map((x, k) => <i key={k} className="es-ponto" style={{ left: pos(x.t) }} title={x.som} />)}
      </div></div>
      <span className="es-agulha" style={{ left: `calc(64px + (100% - 64px) * ${Math.min(1, agora / d)})` }} />
    </div>
  )
}
