// Em que ponto a peça está e a régua de etapas do topo: Texto (ou Roteiro) → Arte / Gravação / Capa → Revisão final.
// Formatos só de texto (e-mail, mensagem, texto) pulam a etapa do meio. Guardado em conteudo.aprovado_texto e
// conteudo.producao_ok; a aprovação final é o status "aprovada" de sempre (coluna Pronto no quadro).
import type { Peca } from '../../comum'
import { infoFormato } from '../formatos'
import { configDe } from './editor'
import { conteudoDe } from './modelo'
import { etapaDe } from '../etapas'

export type Estagio = 'ideia' | 'texto' | 'producao' | 'final' | 'pronto' | 'publicado' | 'descartada'
export type Passo = { nome: string; estado: 'feito' | 'atual' | 'pendente' }

export function estagioDe(p: Peca): Estagio {
  const e = etapaDe(p)
  if (e === 'descartada' || e === 'publicado' || e === 'pronto' || e === 'ideia') return e
  const c = conteudoDe(p)
  if (!c.aprovado_texto) return 'texto'
  if (configDe(p.tipo).etapa2 && !c.producao_ok) return 'producao'
  return 'final'
}

const ORDEM: Estagio[] = ['ideia', 'texto', 'producao', 'final', 'pronto', 'publicado']
const depois = (a: Estagio, b: Estagio) => ORDEM.indexOf(a) > ORDEM.indexOf(b)

export function passosDe(p: Peca): Passo[] {
  const s = estagioDe(p)
  const material = infoFormato(p.tipo).material
  const e2 = configDe(p.tipo).etapa2
  const passos: Passo[] = [
    s === 'ideia' ? { nome: 'Ideia', estado: 'atual' }
      : s === 'texto' || s === 'descartada' ? { nome: `${material} em ${p.conteudo.etapa === 'producao' ? 'elaboração' : 'revisão'}`, estado: 'atual' }
        : { nome: `${material} aprovado`, estado: 'feito' },
  ]
  if (e2) passos.push(s === 'producao' ? { nome: e2.pendente, estado: 'atual' } : depois(s, 'producao') ? { nome: e2.feita, estado: 'feito' } : { nome: e2.pendente, estado: 'pendente' })
  passos.push(s === 'final' ? { nome: 'Revisão final pendente', estado: 'atual' }
    : s === 'pronto' ? { nome: 'Aprovada', estado: 'feito' } : s === 'publicado' ? { nome: 'Publicada', estado: 'feito' } : { nome: 'Revisão final pendente', estado: 'pendente' })
  return passos
}
