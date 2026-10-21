// Campanhas de venda: o cadastro (campanhas_vendas) e o retorno de painel_campanha(id).
export type Campanha = {
  id?: string; nome: string; inicio: string | null; fim: string | null; formulario_slug: string | null; etiqueta: string | null
  ofertas: string[]; meta_vendas: number | null; meta_receita: number | null; observacao: string | null
}
export const CAMPANHA_NOVA: Campanha = { nome: '', inicio: null, fim: null, formulario_slug: null, etiqueta: null, ofertas: [], meta_vendas: null, meta_receita: null, observacao: null }

export type Funil = { fora_hotmart?: number; visitantes: number; abriram_escolha: number; escolheram: number; foram_pagamento: number; pix_ou_abandono: number; compraram: number; desfeitas: number }
export type Origem = { origem: string; leads: number; vendas: number; liquido: number }
export type Vendedora = { nome: string; vendas: number; comissao: number | null }
export type Pendente = { id: string; nome: string | null; telefone: string | null; origem: string; quando: string; dona: string | null; gerou_pix: boolean }
export type Vaga = { codigo: string; modulo: string; data_inicio: string; lugares: number; matriculados: number; compraram: number; livres: number }
export type Venda = { nome: string | null; data: string; valor: number | null; forma: string | null; origem: string; turma: string }
export type Painel = {
  campanha: { id: string; nome: string; inicio: string | null; fim: string | null; meta_vendas: number | null; meta_receita: number | null }
  funil: Funil; receita: { bruto: number; liquido: number; fora_hotmart?: number }; por_origem: Origem[]; por_vendedora: Vendedora[]
  por_dia: { dia: string; vendas: number }[]; pendentes: Pendente[]; vagas: Vaga[]; ultimas: Venda[]
}

const ORIGENS: Record<string, string> = {
  'whatsapp-grupo': 'Grupos de WhatsApp', whatsapp: 'WhatsApp do time', instagram: 'Instagram', youtube: 'YouTube',
  email: 'E-mail', facebook: 'Anúncio (Meta/Google)', 'pix-direto': 'Pix direto (fora da Hotmart)', direto: 'Direto (sem link)', 'hotmart-direto': 'Direto na Hotmart',
}
export function nomeOrigem(codigo: string) {
  if (codigo.startsWith('zap-')) { const n = codigo.slice(4); return `Vendedora: ${n.charAt(0).toUpperCase()}${n.slice(1)}` }
  return ORIGENS[codigo] ?? codigo
}

const MODULOS: Record<string, string> = { UCODES: 'Unique Codes', START: 'Start Pro', COLLAGEN: 'Collagen', SCULPT: 'Sculpt', THREAD: 'Thread' }
export const nomeModulo = (m: string) => MODULOS[m] ?? m

// campanha que está valendo hoje (a mais recente entre as do período); senão, a mais nova
export function campanhaAtual(lista: (Campanha & { id: string })[], hoje: string) {
  return lista.find((c) => (!c.inicio || c.inicio <= hoje) && (!c.fim || c.fim >= hoje)) ?? lista[0]
}

export const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0)
