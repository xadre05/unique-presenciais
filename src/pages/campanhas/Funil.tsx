// Funil da campanha: cada passo com quantas pessoas e quanto passou do passo anterior.
import { pct, type Funil as F } from './dados'

const PASSOS: { k: keyof F; nome: string; dica: string }[] = [
  { k: 'visitantes', nome: 'Entraram na página', dica: 'Pessoas diferentes que abriram a página' },
  { k: 'abriram_escolha', nome: 'Abriram a escolha', dica: 'Clicaram para escolher curso e data' },
  { k: 'escolheram', nome: 'Escolheram a turma', dica: 'Escolheram curso e data' },
  { k: 'foram_pagamento', nome: 'Foram ao pagamento', dica: 'Preencheram os dados e clicaram em "Ir para o pagamento" (viram lead no CRM)' },
  { k: 'pix_ou_abandono', nome: 'Pix/boleto ou carrinho', dica: 'Geraram Pix ou boleto, ou abandonaram o carrinho na Hotmart' },
  { k: 'compraram', nome: 'Compraram', dica: 'Compra aprovada na Hotmart (sem reembolso)' },
]

export function Funil({ f }: { f: F }) {
  return (
    <section className="bloco"><h2>Funil</h2>
      <ol className="blk-funil">{PASSOS.map((p, i) => {
        const anterior = i > 0 ? f[PASSOS[i - 1].k] : 0
        return (
          <li key={p.k} title={p.dica}>
            <small className="muted">{p.nome}</small>
            <b>{f[p.k].toLocaleString('pt-BR')}</b>
            {i > 0 && <small className="muted">{anterior ? `${pct(f[p.k], anterior)}% do passo anterior` : '—'}</small>}
          </li>
        )
      })}</ol>
      <p className="muted pequeno">Os três primeiros passos só aparecem se a página da campanha manda os passos para o sistema.</p>
    </section>
  )
}
