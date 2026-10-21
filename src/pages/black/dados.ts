// Painel da Black 2026: tipos do retorno de painel_black() e os textos da campanha.
export const META_VENDAS = 200          // meta de novembro (Black Friday Limited Edition)
export const META_RECEITA = 1_000_000   // R$ 1 milhão bruto

export type Funil = { visitantes: number; abriram_escolha: number; escolheram: number; foram_pagamento: number; pix_ou_abandono: number; compraram: number; desfeitas: number }
export type Origem = { origem: string; leads: number; vendas: number; liquido: number }
export type Vendedora = { nome: string; vendas: number; comissao: number | null }
export type Pendente = { id: string; nome: string | null; telefone: string | null; origem: string; quando: string; dona: string | null; gerou_pix: boolean }
export type Vaga = { codigo: string; modulo: string; data_inicio: string; lugares: number; matriculados: number; compraram: number; livres: number }
export type Venda = { nome: string | null; data: string; valor: number | null; forma: string | null; origem: string; turma: string }
export type Painel = {
  funil: Funil; receita: { bruto: number; liquido: number }; por_origem: Origem[]; por_vendedora: Vendedora[]
  por_dia: { dia: string; vendas: number }[]; pendentes: Pendente[]; vagas: Vaga[]; ultimas: Venda[]
}

const ORIGENS: Record<string, string> = {
  'whatsapp-grupo': 'Grupos de WhatsApp', whatsapp: 'WhatsApp do time', instagram: 'Instagram', youtube: 'YouTube',
  email: 'E-mail', facebook: 'Anúncio (Meta/Google)', direto: 'Direto (sem link)', 'hotmart-direto': 'Direto na Hotmart',
}
export function nomeOrigem(codigo: string) {
  if (codigo.startsWith('zap-')) { const n = codigo.slice(4); return `Vendedora: ${n.charAt(0).toUpperCase()}${n.slice(1)}` }
  return ORIGENS[codigo] ?? codigo
}

const MODULOS: Record<string, string> = { UCODES: 'Unique Codes', START: 'Start Pro', COLLAGEN: 'Collagen', SCULPT: 'Sculpt', THREAD: 'Thread' }
export const nomeModulo = (m: string) => MODULOS[m] ?? m

export const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0)
