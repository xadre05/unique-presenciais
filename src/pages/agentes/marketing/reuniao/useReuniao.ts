// O andamento de uma Reunião de pauta: abrir (o agente faz a abertura), conversar, corrigir a ata,
// montar o plano a partir da ata, ajustar, aprovar e, se quiser, mandar escrever as peças aprovadas.
import { useEffect, useMemo, useState } from 'react'
import { salvarPlano, type Plano } from '../planos'
import { criarTrabalho, type Campanha } from '../useMarketing'
import { usePropostaPlano } from '../usePropostaPlano'
import { criarReuniao, datasDe, falarNaReuniao, gravarReuniao, horaAgora, lerReuniao, totalDa, type Ata, type Escopo, type Fala, type Reuniao } from './dados'

type Opcoes = { reuniaoId?: string; campanhas: Campanha[]; planos: Plano[]; aoMudou: () => void }

export function useReuniao({ reuniaoId, campanhas, planos, aoMudou }: Opcoes) {
  const [reuniao, setReuniao] = useState<Reuniao | null>(null)
  const [falas, setFalas] = useState<Fala[]>([])
  const [ata, setAta] = useState<Ata>({})
  const [pronta, setPronta] = useState(false)
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(!!reuniaoId)
  const [planoLocal, setPlanoLocal] = useState<Plano | null>(null)
  const [conversando, setConversando] = useState(false)
  const [aprovadas, setAprovadas] = useState<string[] | null>(null)
  const plano = planoLocal ?? planos.find((p) => p.id === reuniao?.plano_id) ?? null
  const proposta = usePropostaPlano(plano, aoMudou)

  const abrir = (r: Reuniao) => { setReuniao(r); setFalas(r.mensagens ?? []); setAta(r.ata ?? {}); setConversando(r.status === 'aberta'); setPlanoLocal(null); setAprovadas(null); setErro(null) }
  useEffect(() => {
    if (!reuniaoId) return
    lerReuniao(reuniaoId).then((r) => { if (r) abrir(r); else setErro('Reunião não encontrada.') }).catch((e) => setErro(e.message)).finally(() => setCarregando(false))
  }, [reuniaoId])

  // correções feitas à mão na ata são guardadas um instante depois de parar de digitar
  useEffect(() => {
    if (!reuniao || reuniao.status !== 'aberta') return
    const t = setTimeout(() => { gravarReuniao(reuniao.id, { ata }).catch(() => undefined) }, 900)
    return () => clearTimeout(t)
  }, [ata]) // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async (r: Reuniao, conversa: Fala[], ataAtual: Ata) => {
    setPensando(true); setErro(null)
    try {
      const resp = await falarNaReuniao(r, conversa, ataAtual)
      const novas = [...conversa, { de: 'agente' as const, texto: resp.resposta, opcoes: resp.opcoes, hora: horaAgora() }]
      const novaAta: Ata = { ...resp.ata, inicio: resp.ata.inicio || ataAtual.inicio || r.escopo.inicio, fim: resp.ata.fim || ataAtual.fim || r.escopo.fim }
      setFalas(novas); setAta(novaAta); setPronta(resp.pronta)
      await gravarReuniao(r.id, { mensagens: novas, ata: novaAta })
    } catch (e) { setErro(e instanceof Error ? e.message : 'O agente não respondeu. Tente de novo.') }
    setPensando(false)
  }
  const comecar = async (escopo: Escopo, titulo: string) => { const r = await criarReuniao(titulo, escopo); abrir(r); setConversando(true); await responder(r, [], r.ata) }
  const falar = (texto: string) => {
    if (!reuniao) return
    const conversa = [...falas, { de: 'equipe' as const, texto, hora: horaAgora() }]
    setFalas(conversa); responder(reuniao, conversa, ata)
  }
  const tentarDeNovo = () => { if (reuniao) responder(reuniao, falas, ata) }

  const campanha = useMemo(() => campanhas.find((c) => c.id === reuniao?.escopo.campanha) ?? campanhas.find((c) => !!ata.campanha && c.nome.toLowerCase() === ata.campanha.toLowerCase()) ?? null, [campanhas, reuniao, ata.campanha])
  const pedido = (p: Plano, r: Reuniao) => {
    const total = totalDa(ata)
    return {
      plano: { id: p.id, nome: p.nome }, datas: datasDe(p.inicio, p.fim), unidade: 'periodo', total, objetivo: ata.objetivo || null, publico: ata.publico || null,
      tema: [r.escopo.texto, ata.observacoes].filter(Boolean).join(' · ') || null, orientacao: null, link: null, campanha,
      canais: (ata.canais ?? []).filter((c) => c.formatos?.length).map((c) => ({ rede: c.rede, formatos: c.formatos, quantidade: total })), ata, reuniao: r.id,
    }
  }
  // a ata vira um plano (o mesmo de antes, se a reunião voltou para a conversa) e o agente monta o calendário
  const montar = async () => {
    if (!reuniao) return
    const inicio = ata.inicio || reuniao.escopo.inicio, fim = ata.fim || reuniao.escopo.fim
    const canais = (ata.canais ?? []).map((c) => ({ rede: c.rede, formatos: c.formatos }))
    const p: Plano = { id: plano?.id ?? reuniao.plano_id ?? crypto.randomUUID(), nome: reuniao.titulo, inicio, fim, objetivo: ata.objetivo, status: 'proposta', criado_em: plano?.criado_em ?? new Date().toISOString(), reuniao: reuniao.id,
      briefing: { modo: 'periodo', objetivo: ata.objetivo ?? '', publico: ata.publico ?? '', campanha: campanha?.id ?? '', canais, total: totalDa(ata), diasSemana: [0, 1, 2, 3, 4, 5, 6], orientacao: '', link: '' } }
    const s = await salvarPlano(p); if (s.error) return setErro(s.error.message)
    try { await gravarReuniao(reuniao.id, { plano_id: p.id, status: 'plano', ata }) } catch (e) { return setErro((e as Error).message) }
    setPlanoLocal(p); setReuniao({ ...reuniao, plano_id: p.id, status: 'plano' }); setConversando(false); setAprovadas(null)
    if (await proposta.pedirProposta(pedido(p, reuniao))) aoMudou()
  }
  const ajustar = (instrucao: string) => { if (plano && reuniao) proposta.pedirProposta(pedido(plano, reuniao), instrucao) }
  const aprovar = async () => {
    if (!reuniao || !plano) return
    const ids = await proposta.aprovar()
    setPlanoLocal({ ...plano, status: 'aprovado' }); setAprovadas(ids)
    await gravarReuniao(reuniao.id, { status: 'fechada' }).catch(() => undefined)
    setReuniao({ ...reuniao, status: 'fechada' })
  }
  // depois de aprovar: o agente escreve os textos das peças aprovadas (custo à parte)
  const escreverAgora = async () => {
    if (!aprovadas?.length) return null
    const { erro: e } = await criarTrabalho('escrever', { peca_ids: aprovadas })
    if (e) { setErro(e); return null }
    aoMudou()
    return aprovadas
  }
  const reabrir = () => setConversando(true)
  const novaReuniao = () => { setReuniao(null); setFalas([]); setAta({}); setPronta(false); setPlanoLocal(null); setAprovadas(null); setErro(null) }

  return { reuniao, falas, ata, setAta, pronta, pensando, erro, carregando, plano, proposta, conversando, aprovadas, comecar, falar, tentarDeNovo, montar, ajustar, aprovar, escreverAgora, reabrir, novaReuniao }
}
