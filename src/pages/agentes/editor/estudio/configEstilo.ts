// Ajustes finos do estilo escolhido, só para um vídeo: viram uma instrução clara para o agente na edição.
import type { ConfigEstilo } from '../../marketing/edicao/dados'
import { VISUAL_PADRAO, type Visual } from '../../marketing/edicao/acabamento'

export const OPCOES = {
  ritmo: { titulo: 'Ritmo', icone: 'relogio', valores: { rapido: 'Rápido', moderado: 'Moderado', calmo: 'Calmo' } },
  legenda: { titulo: 'Legendas', icone: 'texto', valores: { palavras: 'Palavra por palavra', chave: 'Palavra-chave' } },
  imagens: { titulo: 'Imagens', icone: 'imagem', valores: { muitas: 'Frequentes', algumas: 'Algumas', poucas: 'Poucas' } },
  efeitos: { titulo: 'Efeitos sonoros', icone: 'raio', valores: { muitos: 'Muitos', poucos: 'Poucos', nenhum: 'Nenhum' } },
  enquadramento: { titulo: 'Enquadramento', icone: 'celular', valores: { cheio: 'Tela cheia', cartao: 'Rosto em cartão' } },
  acabamento: { titulo: 'Acabamento', icone: 'floco', valores: { limpo: 'Limpo', cinema: 'Cinema', papel: 'Papel', arquivo: 'Arquivo P&B' } },
  pip: { titulo: 'Rosto nas cenas', icone: 'usuario', valores: { canto: 'No canto', nao: 'Não aparece' } },
} as const
// o que é só da montagem (não vai para o agente)
export const SO_VISUAL: ChaveConfig[] = ['enquadramento', 'acabamento', 'pip']
export type ChaveConfig = keyof typeof OPCOES

const INSTRUCAO: Partial<Record<ChaveConfig, Record<string, string>>> = {
  ritmo: { rapido: 'ritmo RÁPIDO: corte todas as pausas e respiros, trechos curtos', moderado: 'ritmo MODERADO: corte pausas longas, mantenha respiros naturais', calmo: 'ritmo CALMO: só corte erros e pausas muito longas' },
  legenda: { palavras: 'legenda palavra por palavra', chave: 'legenda só com palavras-chave' },
  imagens: { muitas: 'imagens de apoio frequentes (a cada 3 a 5 s)', algumas: 'algumas imagens de apoio nos momentos certos', poucas: 'poucas imagens de apoio, foco no rosto' },
  efeitos: { muitos: 'muitos efeitos sonoros', poucos: 'poucos efeitos sonoros, só nos destaques', nenhum: 'nenhum efeito sonoro' },
  enquadramento: { cartao: 'a pessoa aparece num cartão arredondado sobre o fundo da marca (ocupa a parte de cima da tela; a legenda fica embaixo do cartão)' },
  pip: { canto: 'nas cenas e mídias em tela cheia a pessoa continua num círculo no canto inferior direito: não ponha texto importante nesse canto' },
}

export function pedidoDoConfig(c?: ConfigEstilo) {
  if (!c) return ''
  const partes = (Object.keys(INSTRUCAO) as ChaveConfig[]).map((k) => (c[k] ? INSTRUCAO[k]?.[c[k]!] ?? '' : '')).filter(Boolean)
  return partes.length ? `Ajustes do estilo para este vídeo: ${partes.join('; ')}.` : ''
}

export function descreverConfig(c: ConfigEstilo) {
  const v = (k: ChaveConfig) => (c[k] ? (OPCOES[k].valores as Record<string, string>)[c[k]!] : null)
  return [v('ritmo') && `ritmo ${v('ritmo')!.toLowerCase()}`, v('legenda') && `legendas ${v('legenda')!.toLowerCase()}`, v('imagens') && `imagens ${v('imagens')!.toLowerCase()}`, v('efeitos') && `efeitos sonoros: ${v('efeitos')!.toLowerCase()}`, c.enquadramento === 'cartao' && 'rosto em cartão sobre o fundo da marca', c.acabamento && c.acabamento !== 'limpo' && `acabamento ${v('acabamento')!.toLowerCase()}`].filter(Boolean).join(', ')
}

export const visualDoConfig = (c?: ConfigEstilo): Visual => ({ enquadramento: c?.enquadramento ?? VISUAL_PADRAO.enquadramento, acabamento: c?.acabamento ?? VISUAL_PADRAO.acabamento, pip: (c?.pip ?? 'canto') === 'canto' })
