// Parte de baixo da etapa Estilo: os pontos principais do estilo escolhido, ajustáveis só para este vídeo, uma amostra
// de como a legenda fica e a opção de levar os ajustes para o estilo da casa.
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { guardarEdicao, type ConfigEstilo } from '../../marketing/edicao/dados'
import { guardarEstilo, type Estilo } from '../dados'
import { descreverConfig, OPCOES, type ChaveConfig } from './configEstilo'

// amostra estática da legenda: palavra por palavra (uma em destaque) ou palavra-chave em caixa
export function AmostraLegenda({ legenda, frase = ['Aqui você aprende', 'na prática'] }: { legenda: 'palavras' | 'chave'; frase?: [string, string] | string[] }) {
  return (
    <div className={`es-amostra ${legenda}`} aria-hidden>
      <span className="es-amostra-rosto" />
      {legenda === 'chave' ? <span className="es-amostra-txt"><b>{frase[0]}</b><i>{frase[1]}</i></span>
        : <span className="es-amostra-txt"><b>{frase[0]}</b> <em>{frase[1]}</em></span>}
    </div>
  )
}

export function ConfigDoEstilo({ pecaId, base, config, aoMudar }: { pecaId: string; base: Estilo; config: ConfigEstilo; aoMudar: () => void }) {
  const [salvarNaCasa, setSalvarNaCasa] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const efetivo: Required<ConfigEstilo> = { ritmo: config.ritmo ?? 'moderado', legenda: config.legenda ?? base.legenda, imagens: config.imagens ?? base.imagens, efeitos: config.efeitos ?? base.efeitos }
  const mudar = async (k: ChaveConfig, v: string) => {
    const novo = { ...config, [k]: v } as ConfigEstilo
    await guardarEdicao(pecaId, (e) => ({ ...e, config_estilo: novo }))
    if (salvarNaCasa) await levarParaCasa(novo)
    aoMudar()
  }
  const levarParaCasa = async (c: ConfigEstilo) => {
    const erro = await guardarEstilo({ ...base, legenda: c.legenda ?? base.legenda, imagens: c.imagens ?? base.imagens, efeitos: c.efeitos ?? base.efeitos })
    setAviso(erro ?? 'Guardado como estilo da casa: vale para os próximos vídeos.')
  }
  return (
    <section className="es-config">
      <h3>Configurações do estilo selecionado</h3>
      <p className="muted pequeno">Ajuste os pontos principais antes de continuar.</p>
      <div className="es-config-campos">{(Object.keys(OPCOES) as ChaveConfig[]).map((k) => (
        <label key={k} className="es-config-campo">
          <Icone nome={OPCOES[k].icone} tam={18} />
          <span><small>{OPCOES[k].titulo}</small>
            <select value={efetivo[k]} onChange={(x) => void mudar(k, x.target.value)}>
              {Object.entries(OPCOES[k].valores).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></span>
        </label>))}</div>
      <div className="es-config-amostra">
        <AmostraLegenda legenda={efetivo.legenda} frase={['Exemplo', 'de legenda']} />
        <div>
          <b>Como fica esse estilo?</b>
          <p className="muted pequeno">Edição com {descreverConfig(efetivo)}. A fala continua em primeiro plano; o resto ajuda a prender a atenção.</p>
          <p className="es-aviso pequeno"><Icone nome="info" tam={14} /> Esta escolha vale apenas para este vídeo.</p>
          <label className="pequeno es-config-casa"><input type="checkbox" checked={salvarNaCasa} onChange={(x) => { setSalvarNaCasa(x.target.checked); if (x.target.checked) void levarParaCasa(efetivo) }} /> Salvar como estilo da marca</label>
          {aviso && <p className="ok-txt pequeno">{aviso}</p>}
        </div>
      </div>
    </section>
  )
}
