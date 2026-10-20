// Nota da pessoa (0 a 100) e as duas marcas que dá para filtrar separado: temperatura (interesse) e pagador (histórico de pagamento).
// Calculada no banco de hora em hora (atualizar_notas_contatos); aqui só rótulos, cores e a busca em lote.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type NotaPessoa = { nota: number | null; temperatura: string | null; pagador: string | null; motivos?: string[] | null }

export const TEMPERATURA: Record<string, { rotulo: string; tom: string; explica: string }> = {
  quente: { rotulo: 'Quente', tom: 'erro', explica: 'Mandou mensagem, entrou como lead ou tentou comprar nos últimos 30 dias' },
  morna: { rotulo: 'Morna', tom: 'alerta', explica: 'Sinal de interesse nos últimos 90 dias ou comprou no último ano' },
  fria: { rotulo: 'Fria', tom: 'info', explica: 'Nenhum sinal de interesse há mais de 90 dias' },
}

export const PAGADOR: Record<string, { rotulo: string; tom: string; explica: string }> = {
  bom: { rotulo: 'Bom pagador', tom: 'ok', explica: 'Comprou e não tem nada em aberto' },
  atrasou_pagou: { rotulo: 'Atrasou e pagou', tom: 'info', explica: 'Teve cobrança e regularizou' },
  sem_historico: { rotulo: 'Sem compra', tom: 'neutro', explica: 'Ainda não comprou nada' },
  reembolsou: { rotulo: 'Pediu reembolso', tom: 'alerta', explica: 'Pediu reembolso ou deu chargeback' },
  devendo: { rotulo: 'Devendo', tom: 'erro', explica: 'Tem parcela em aberto na fila de cobrança' },
  negativado: { rotulo: 'Negativado', tom: 'erro', explica: 'Negativado ou com negativação pedida' },
}

// faixas da nota para o filtro (o banco filtra por nota_min/nota_max)
export const FAIXAS_NOTA: { valor: string; rotulo: string; min?: number; max?: number }[] = [
  { valor: '80', rotulo: 'Nota 80 a 100 (ótima)', min: 80 },
  { valor: '60', rotulo: 'Nota 60 a 79 (boa)', min: 60, max: 79 },
  { valor: '40', rotulo: 'Nota 40 a 59 (neutra)', min: 40, max: 59 },
  { valor: '0', rotulo: 'Nota abaixo de 40 (atenção)', max: 39 },
]
export const faixaDaNota = (min?: string, max?: string) => FAIXAS_NOTA.find((f) => String(f.min ?? '') === (min ?? '') && String(f.max ?? '') === (max ?? ''))?.valor ?? ''

export function tomDaNota(n: number | null | undefined) {
  if (n == null) return 'neutro'
  if (n >= 80) return 'ok'
  if (n >= 60) return 'info'
  if (n >= 40) return 'neutro'
  if (n >= 20) return 'alerta'
  return 'erro'
}

export type PessoaChave = { k: string; email?: string | null; tel?: string | null }

// nota de várias pessoas de uma vez (por e-mail ou WhatsApp); devolve um mapa chave → nota
export function useNotasDePessoas(pessoas: PessoaChave[]) {
  const [notas, setNotas] = useState<Record<string, NotaPessoa>>({})
  const lista = useMemo(() => pessoas.filter((p) => p.email || p.tel), [pessoas])
  const chave = useMemo(() => lista.map((p) => `${p.k}|${p.email ?? ''}|${p.tel ?? ''}`).join(','), [lista])
  useEffect(() => {
    if (!lista.length) return
    let vivo = true
    const lotes: PessoaChave[][] = []
    for (let i = 0; i < lista.length; i += 500) lotes.push(lista.slice(i, i + 500))
    Promise.all(lotes.map((l) => supabase.rpc('notas_de_pessoas', { p: l }))).then((rs) => {
      if (!vivo) return
      const tudo: Record<string, NotaPessoa> = {}
      for (const r of rs) if (!r.error && r.data) Object.assign(tudo, r.data as Record<string, NotaPessoa>)
      setNotas(tudo)
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return notas
}
