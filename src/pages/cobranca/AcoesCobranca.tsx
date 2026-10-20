// Coluna "Cobrança" da lista de atrasados do online (administrador): situação, com quem está, passar para uma
// vendedora, mandar WhatsApp e registrar contato. A cobrança é criada na primeira ação.
import { useState } from 'react'
import { Badge, Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { dataBR } from '../../lib/format'
import { SITUACAO_COBRANCA, chaveOnline, passarCobranca, registrarContato, type Cobranca, type CompraChave } from './dados'
import { MensagemWhats } from './MensagemWhats'
import { RegistrarContato } from './RegistrarContato'

export type AtrasoCobranca = CompraChave & {
  comprador_nome: string | null; produto_nome: string | null; integracao_id: string; valor_vencido: number; cobrancas_vencidas: number; proxima_data: string | null
}
type Props = {
  atraso: AtrasoCobranca; telefone: string | null; cobranca: Cobranca | null; vendedoras: { id: string; nome: string }[]
  marca: string; eu: string; aoMudar: () => void
}

export function AcoesCobranca({ atraso: a, telefone, cobranca, vendedoras, marca, eu, aoMudar }: Props) {
  const [aberto, setAberto] = useState<'whats' | 'registrar' | null>(null)
  const [atual, setAtual] = useState<Cobranca | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const nova = {
    chave: chaveOnline(a), integracao_id: a.integracao_id, aluno_nome: a.comprador_nome, email: a.em, telefone, produto: a.produto_nome,
    valor_vencido: a.valor_vencido, cobrancas_vencidas: a.cobrancas_vencidas, venceu_em: a.proxima_data,
  }
  const garantir = async (): Promise<Cobranca> => {
    if (cobranca) return cobranca
    const id = await passarCobranca(null, nova, null, eu)
    return { ...nova, id, origem: 'online', responsavel_id: null, situacao: 'aberta', promessa_em: null, ultimo_contato_em: null, criado_em: new Date().toISOString() }
  }
  const passar = async (responsavel: string) => {
    setErro(null)
    try { await passarCobranca(cobranca, nova, responsavel || null, eu); aoMudar() } catch (e) { setErro((e as Error).message) }
  }
  const abrir = async (qual: 'whats' | 'registrar') => {
    setErro(null)
    try { setAtual(await garantir()); setAberto(qual) } catch (e) { setErro((e as Error).message) }
  }
  const fechar = () => { setAberto(null); aoMudar() }
  const s = cobranca ? SITUACAO_COBRANCA[cobranca.situacao] : null

  return (
    <div className="cob-celula">
      <div>{s ? <Badge tom={s.tom}>{s.rotulo}</Badge> : <span className="muted pequeno">Ainda não cobrado</span>}
        {cobranca?.promessa_em && cobranca.situacao === 'prometeu' && <span className="muted pequeno"> até {dataBR(cobranca.promessa_em)}</span>}</div>
      <label className="select-icone cob-passar"><select value={cobranca?.responsavel_id ?? ''} onChange={(e) => passar(e.target.value)} aria-label="Quem cobra">
        <option value="">{cobranca?.responsavel_id ? 'Tirar da vendedora' : 'Passar para…'}</option>
        {vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>
      <div className="cob-botoes">
        <button type="button" className="btn btn-mini btn-contorno" disabled={!telefone} title={telefone ? '' : 'Sem telefone no CRM'} onClick={() => abrir('whats')}><Icone nome="whats" tam={14} /> WhatsApp</button>
        <button type="button" className="btn btn-mini" onClick={() => abrir('registrar')}><Icone nome="lapis" tam={13} /> Registrar</button>
      </div>
      <Erro msg={erro} />
      {aberto === 'whats' && atual && <MensagemWhats dados={{ ...atual, telefone }} eu={eu} marca={marca} aoFechar={fechar}
        aoEnviar={(texto) => registrarContato(atual.id, { canal: 'whatsapp', resultado: 'Mandei mensagem pelo WhatsApp', observacao: texto }, eu)} />}
      {aberto === 'registrar' && atual && <RegistrarContato cobranca={atual} eu={eu} aoFechar={() => setAberto(null)} aoSalvar={fechar} />}
    </div>
  )
}
