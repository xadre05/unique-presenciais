// Ajustes finos do estilo escolhido, só para um vídeo: viram uma instrução clara para o agente na edição.
import type { ConfigEstilo } from '../../marketing/edicao/dados'

export const OPCOES = {
  ritmo: { titulo: 'Ritmo', icone: 'relogio', valores: { rapido: 'Rápido', moderado: 'Moderado', calmo: 'Calmo' } },
  legenda: { titulo: 'Legendas', icone: 'texto', valores: { palavras: 'Palavra por palavra', chave: 'Palavra-chave' } },
  imagens: { titulo: 'Imagens', icone: 'imagem', valores: { muitas: 'Frequentes', algumas: 'Algumas', poucas: 'Poucas' } },
  efeitos: { titulo: 'Efeitos sonoros', icone: 'raio', valores: { muitos: 'Muitos', poucos: 'Poucos', nenhum: 'Nenhum' } },
} as const
export type ChaveConfig = keyof typeof OPCOES

const INSTRUCAO: { [K in ChaveConfig]: Record<string, string> } = {
  ritmo: { rapido: 'ritmo RÁPIDO: corte todas as pausas e respiros, trechos curtos', moderado: 'ritmo MODERADO: corte pausas longas, mantenha respiros naturais', calmo: 'ritmo CALMO: só corte erros e pausas muito longas' },
  legenda: { palavras: 'legenda palavra por palavra', chave: 'legenda só com palavras-chave' },
  imagens: { muitas: 'imagens de apoio frequentes (a cada 3 a 5 s)', algumas: 'algumas imagens de apoio nos momentos certos', poucas: 'poucas imagens de apoio, foco no rosto' },
  efeitos: { muitos: 'muitos efeitos sonoros', poucos: 'poucos efeitos sonoros, só nos destaques', nenhum: 'nenhum efeito sonoro' },
}

export function pedidoDoConfig(c?: ConfigEstilo) {
  if (!c) return ''
  const partes = (Object.keys(INSTRUCAO) as ChaveConfig[]).map((k) => (c[k] ? INSTRUCAO[k][c[k]!] : '')).filter(Boolean)
  return partes.length ? `Ajustes do estilo para este vídeo: ${partes.join('; ')}.` : ''
}

export function descreverConfig(c: ConfigEstilo) {
  const v = (k: ChaveConfig) => (c[k] ? (OPCOES[k].valores as Record<string, string>)[c[k]!] : null)
  return [v('ritmo') && `ritmo ${v('ritmo')!.toLowerCase()}`, v('legenda') && `legendas ${v('legenda')!.toLowerCase()}`, v('imagens') && `imagens ${v('imagens')!.toLowerCase()}`, v('efeitos') && `efeitos sonoros: ${v('efeitos')!.toLowerCase()}`].filter(Boolean).join(', ')
}
