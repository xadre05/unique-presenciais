// A conta da Hotmart escolhida no filtro (vale para o painel e para as telas do online durante a visita) e o nome curto de cada conta
import { useState } from 'react'
import { nomeCurtoConta, useContasHotmart } from './dados'

const CHAVE = 'unique.contaHotmart'
const ler = () => { try { return sessionStorage.getItem(CHAVE) ?? '' } catch { return '' } }

export function useContaEscolhida() {
  const [conta, setConta] = useState(ler)
  const mudar = (v: string) => { setConta(v); try { sessionStorage.setItem(CHAVE, v) } catch { /* sem armazenamento: vale só nesta tela */ } }
  return [conta, mudar] as const
}

export function useNomeConta() {
  const contas = useContasHotmart()
  return (id: string | null | undefined) => nomeCurtoConta((contas.dados ?? []).find((c) => c.id === id)?.nome ?? '')
}
