// Configurações → Inteligências artificiais: a chave de cada IA (cifrada no servidor) e qual IA faz cada trabalho.
// Trocar uma chave é só colar a nova por cima. Nenhuma chave volta para a tela depois de salva: só o final (••••a1b2).
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { dataHoraBR } from '../../lib/format'
import { Badge, Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { NOME_TRABALHO, ORDEM, PROVEDORES, modelosDe, quemFaz, type ChaveCadastrada, type Escolha, type EscolhaIAs, type Provedor, type Trabalho } from './ias'

function CartaoChave({ empresa, p, chave, aoSalvar }: { empresa: string; p: Provedor; chave: ChaveCadastrada | undefined; aoSalvar: () => void }) {
  const info = PROVEDORES[p]
  const [valor, setValor] = useState('')
  const [abrir, setAbrir] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const salvar = async () => {
    setErro(null); setOk(false)
    const { error } = await supabase.rpc('agentes_salvar_chave_ia', { p_empresa: empresa, p_provedor: p, p_valor: valor })
    if (error) return setErro(msgErro(error))
    setValor(''); setOk(true); aoSalvar()
  }
  return (
    <div className={`ia-cartao${chave ? ' ligada' : ''}`}>
      <div className="ia-topo">
        <div><b>{info.nome}</b> <span className="muted pequeno">· {info.empresa}</span><p className="muted pequeno">{info.faz}</p></div>
        {chave ? <Badge tom="ok">Cadastrada ••••{chave.final} · {dataHoraBR(chave.cadastrada_em)}</Badge> : <Badge tom="apagado">Sem chave</Badge>}
      </div>
      <div className="ia-linha">
        <input type="password" autoComplete="off" value={valor} onChange={(e) => { setValor(e.target.value); setOk(false) }} placeholder={`${chave ? 'Trocar a chave' : 'Colar a chave'}${info.prefixo ? ` (começa com ${info.prefixo})` : ' (KEY_ID:KEY_SECRET)'}`} aria-label={`Chave ${info.nome}`} />
        <button className="btn btn-ouro" disabled={!valor.trim()} onClick={salvar}>Salvar</button>
      </div>
      <button type="button" className="link pequeno" onClick={() => setAbrir(!abrir)}><Icone nome={abrir ? 'seta' : 'info'} tam={14} /> Como pegar a chave em {info.site}</button>
      {abrir && <ol className="passos pequeno">{info.passos.map((x) => <li key={x}>{x}</li>)}<li>Cole aqui e salve. A chave fica cifrada no servidor: ninguém consegue ver de volta, só trocar.</li></ol>}
      <Erro msg={erro} />{ok && <p className="ok-txt pequeno">Chave salva ✓</p>}
    </div>
  )
}

function QuemFaz({ chaves, ias, aoMudar }: { chaves: Provedor[]; ias: EscolhaIAs; aoMudar: (t: Trabalho, e: Escolha) => void }) {
  return (
    <div className="ia-quem">
      {(['texto', 'imagem'] as Trabalho[]).map((t) => {
        const atual = ias[t] ?? { provedor: 'auto' }
        const valor = atual.provedor === 'auto' ? 'auto' : `${atual.provedor}:${atual.modelo ?? ''}`
        const faz = quemFaz(t, atual, chaves)
        return (
          <div key={t} className="ia-quem-linha">
            <span className="pp-rotulo">{NOME_TRABALHO[t]}</span>
            <span className="select-icone"><select value={valor} onChange={(e) => {
              const v = e.target.value
              if (v === 'auto') return aoMudar(t, { provedor: 'auto' })
              const [p, m] = v.split(':'); aoMudar(t, { provedor: p as Provedor, modelo: m })
            }}>
              <option value="auto">Automático (o sistema escolhe a melhor)</option>
              {modelosDe(t).map((m) => (
                <option key={m.id} value={`${m.provedor}:${m.id}`} disabled={!chaves.includes(m.provedor)}>
                  {m.nome}{!chaves.includes(m.provedor) ? ' (falta a chave)' : !m.pronto ? ' (em breve)' : ''}
                </option>
              ))}
            </select></span>
            <span className="muted pequeno">{faz ? `Hoje quem faz: ${PROVEDORES[faz].nome}.` : 'Nenhuma IA com chave para este trabalho.'} {modelosDe(t).find((m) => m.provedor === faz)?.dica ?? ''}</span>
          </div>
        )
      })}
      <p className="muted pequeno"><Icone nome="info" tam={14} /> Automático: texto com o Claude; imagem com o GPT Image (põe pessoas reais e escreve na arte). Com outras chaves cadastradas, dá para escolher outra IA para cada trabalho.</p>
    </div>
  )
}

export function ChavesIA({ empresa, ias, aoMudarIAs }: { empresa: string; ias: EscolhaIAs; aoMudarIAs: (novo: EscolhaIAs) => void }) {
  const chaves = useConsulta<ChaveCadastrada[]>(() => supabase.from('agentes_chaves').select('provedor,final,cadastrada_em').eq('empresa_id', empresa))
  const lista = chaves.dados ?? []
  const comChave = lista.map((c) => c.provedor)
  return (
    <>
      <section className="bloco">
        <div className="bloco-topo"><h2>Inteligências artificiais</h2><span className="muted pequeno">{comChave.length} de {ORDEM.length} com chave</span></div>
        <p className="muted pequeno">Cada IA é boa em uma coisa. Cadastre a chave das que for usar; a cobrança vem direto de cada empresa de IA, pelo uso.</p>
        <div className="ia-grade">{ORDEM.map((p) => <CartaoChave key={p} empresa={empresa} p={p} chave={lista.find((c) => c.provedor === p)} aoSalvar={chaves.recarregar} />)}</div>
        <Erro msg={chaves.erro} />
      </section>
      <section className="bloco">
        <h2>Qual IA faz cada trabalho</h2>
        <QuemFaz chaves={comChave} ias={ias} aoMudar={(t, e) => aoMudarIAs({ ...ias, [t]: e })} />
      </section>
    </>
  )
}
