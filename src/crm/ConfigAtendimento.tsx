// CRM — NÚCLEO: configurações do atendimento (números, etapas do funil, respostas prontas).
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Campo, Erro, InputNumero, Modal } from '../components/ui'
import { STATUS_CANAL, TIPO_CANAL, type BaseCRM, type Cadencia, type Canal, type Etapa, type Passo } from './tipos'

const URL_FUNCAO = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-whatsapp`

export default function ConfigAtendimento({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [aba, setAba] = useState<'numeros' | 'etapas' | 'respostas' | 'followups' | 'motivos'>('numeros')
  return (
    <div>
      <nav className="abas">
        <button className={aba === 'numeros' ? 'ativa' : ''} onClick={() => setAba('numeros')}>Números de WhatsApp</button>
        <button className={aba === 'etapas' ? 'ativa' : ''} onClick={() => setAba('etapas')}>Etapas do funil</button>
        <button className={aba === 'respostas' ? 'ativa' : ''} onClick={() => setAba('respostas')}>Respostas prontas</button>
        <button className={aba === 'followups' ? 'ativa' : ''} onClick={() => setAba('followups')}>Follow-ups automáticos</button>
        <button className={aba === 'motivos' ? 'ativa' : ''} onClick={() => setAba('motivos')}>Motivos de perda</button>
      </nav>
      {aba === 'numeros' && <Numeros empresaId={empresaId} base={base} />}
      {aba === 'etapas' && <Etapas empresaId={empresaId} base={base} />}
      {aba === 'respostas' && <Respostas empresaId={empresaId} base={base} />}
      {aba === 'followups' && <Followups empresaId={empresaId} base={base} />}
      {aba === 'motivos' && <Motivos empresaId={empresaId} base={base} />}
    </div>
  )
}

function Numeros({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [editar, setEditar] = useState<Canal | 'novo' | null>(null)
  return (
    <section>
      <p className="muted">Cada número de WhatsApp da empresa ligado ao sistema. O <b>ritmo</b> vale só para disparos; conversa normal não tem limite.</p>
      <div className="cards">
        {base.canais.map((k) => (
          <div key={k.id} className="card-lista">
            <div className="card-lista-topo"><h3>{k.nome}</h3><Badge tom={STATUS_CANAL[k.status].tom}>{STATUS_CANAL[k.status].rotulo}</Badge></div>
            <div className="muted pequeno">{TIPO_CANAL[k.tipo]}{k.telefone ? ` · ${k.telefone}` : ''}</div>
            <div className="pequeno">Disparo: até <b>{k.ritmo_por_hora}</b> por hora, das {k.janela_inicio.slice(0, 5)} às {k.janela_fim.slice(0, 5)}</div>
            {k.status_info && <div className="muted pequeno">{k.status_info}</div>}
            <div className="acoes"><button className="btn btn-mini" onClick={() => setEditar(k)}>Ajustar</button></div>
          </div>
        ))}
      </div>
      <button className="btn btn-contorno mt" onClick={() => setEditar('novo')}>+ Ligar outro número</button>
      {editar && <EditarCanal empresaId={empresaId} canal={editar === 'novo' ? null : editar} onFechar={() => setEditar(null)} onFeito={() => { setEditar(null); base.recarregar() }} />}
    </section>
  )
}

function EditarCanal({ empresaId, canal, onFechar, onFeito }: { empresaId: string; canal: Canal | null; onFechar: () => void; onFeito: () => void }) {
  const [nome, setNome] = useState(canal?.nome ?? '')
  const [tipo, setTipo] = useState<Canal['tipo']>(canal?.tipo ?? 'whatsapp_qr')
  const [telefone, setTelefone] = useState(canal?.telefone ?? '')
  const [ritmo, setRitmo] = useState(canal?.ritmo_por_hora ?? 20)
  const [ini, setIni] = useState(canal?.janela_inicio.slice(0, 5) ?? '08:00')
  const [fim, setFim] = useState(canal?.janela_fim.slice(0, 5) ?? '20:00')
  const [cfg, setCfg] = useState<Record<string, string>>(canal?.config ?? {})
  const [segredo, setSegredo] = useState('')
  const [info, setInfo] = useState<{ chave_webhook: string; salvos: string[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { if (canal) supabase.rpc('crm_info_canal', { p_canal: canal.id }).then(({ data }) => setInfo(data)) }, [canal])
  const campoSegredo = tipo === 'whatsapp_qr' ? 'apikey' : tipo === 'whatsapp_oficial' ? 'token' : null

  const salvar = async () => {
    setErro(null)
    const reg = { empresa_id: empresaId, nome: nome.trim(), tipo, telefone: telefone.trim() || null, ritmo_por_hora: ritmo, janela_inicio: ini, janela_fim: fim, config: cfg,
      ...(tipo === 'teste' ? { status: 'conectado' } : {}) }
    const r = canal ? await supabase.from('crm_canais').update(reg).eq('id', canal.id).select('id').single() : await supabase.from('crm_canais').insert(reg).select('id').single()
    if (r.error) return setErro(r.error.message)
    if (campoSegredo && segredo.trim()) {
      const { error } = await supabase.rpc('crm_salvar_segredo_canal', { p_canal: r.data.id, p_campo: campoSegredo, p_valor: segredo.trim() })
      if (error) return setErro(error.message)
    }
    onFeito()
  }
  const webhook = canal && info ? `${URL_FUNCAO}?canal=${canal.id}${tipo === 'whatsapp_oficial' ? '' : `&chave=${info.chave_webhook}`}` : null
  return (
    <Modal titulo={canal ? `Ajustar ${canal.nome}` : 'Ligar número de WhatsApp'} aberto onFechar={onFechar} largo>
      <div className="form-grade">
        <Campo rotulo="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Comercial 1" /></Campo>
        <Campo rotulo="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value as Canal['tipo'])} disabled={!!canal}>
          {Object.entries(TIPO_CANAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></Campo>
        <Campo rotulo="Número (com 55 e DDD)"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="5511999998888" /></Campo>
        <Campo rotulo="Disparo: mensagens por hora" dica="Número novo: comece com 10–20 e vá subindo"><InputNumero valor={ritmo} onChange={setRitmo} min={1} max={1000} /></Campo>
        <Campo rotulo="Disparo começa às"><input type="time" value={ini} onChange={(e) => setIni(e.target.value)} /></Campo>
        <Campo rotulo="Disparo para às"><input type="time" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
      </div>
      {tipo === 'whatsapp_qr' && (<>
        <h3>Servidor do WhatsApp (QR code)</h3>
        <p className="muted pequeno">Precisa de um servidor próprio com o Evolution API ligado ao número. Os dados abaixo vêm de lá.</p>
        <div className="form-grade">
          <Campo rotulo="Endereço do servidor"><input value={cfg.url ?? ''} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} placeholder="https://whats.seudominio.com.br" /></Campo>
          <Campo rotulo="Nome da instância"><input value={cfg.instancia ?? ''} onChange={(e) => setCfg({ ...cfg, instancia: e.target.value })} /></Campo>
        </div>
      </>)}
      {tipo === 'whatsapp_oficial' && (<>
        <h3>API oficial (Meta)</h3>
        <div className="form-grade">
          <Campo rotulo="ID do número (Phone number ID)"><input value={cfg.phone_number_id ?? ''} onChange={(e) => setCfg({ ...cfg, phone_number_id: e.target.value })} /></Campo>
        </div>
      </>)}
      {campoSegredo && (
        <Campo rotulo={campoSegredo === 'apikey' ? 'Chave do servidor (apikey)' : 'Token de acesso da Meta'} dica={info?.salvos.includes(campoSegredo) ? 'Já tem uma chave salva. Preencha só se quiser trocar.' : 'Fica guardada no servidor; não aparece mais na tela.'}>
          <input type="password" value={segredo} onChange={(e) => setSegredo(e.target.value)} autoComplete="new-password" />
        </Campo>
      )}
      {webhook && tipo !== 'teste' && (
        <div className="nota pequeno"><b>Endereço para receber mensagens (webhook):</b> cole no {tipo === 'whatsapp_qr' ? 'servidor do WhatsApp' : 'painel da Meta'}.
          <div className="link-endereco">{webhook}</div>
          {tipo === 'whatsapp_oficial' && <>Token de verificação: <span className="link-endereco">{info?.chave_webhook}</span></>}
        </div>
      )}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar} disabled={!nome.trim()}>Salvar</button></div>
    </Modal>
  )
}

function Etapas({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [lista, setLista] = useState<Etapa[]>(base.etapas)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => setLista(base.etapas), [base.etapas])
  const salvar = async (e: Etapa) => { const { error } = await supabase.from('crm_etapas').update({ nome: e.nome, cor: e.cor, final: e.final, ordem: e.ordem }).eq('id', e.id); if (error) setErro(error.message) }
  const mover = async (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= lista.length) return
    const n = [...lista]; [n[i], n[j]] = [n[j], n[i]]
    const comOrdem = n.map((e, k) => ({ ...e, ordem: k + 1 }))
    setLista(comOrdem)
    for (const e of comOrdem) await salvar(e)
    base.recarregar()
  }
  const nova = async () => {
    const { error } = await supabase.from('crm_etapas').insert({ empresa_id: empresaId, nome: 'Nova etapa', ordem: lista.length + 1 })
    if (error) setErro(error.message); else base.recarregar()
  }
  const apagar = async (id: string) => { const { error } = await supabase.from('crm_etapas').delete().eq('id', id); if (error) setErro(error.message); else base.recarregar() }
  return (
    <section className="bloco">
      <p className="muted">As colunas do funil, na ordem. Quem responde uma mensagem entra na primeira. Marque as etapas de fim (ganho ou perdido).</p>
      <table className="tabela compacta">
        <thead><tr><th></th><th>Etapa</th><th>Cor</th><th>É fim?</th><th></th></tr></thead>
        <tbody>{lista.map((e, i) => (
          <tr key={e.id}>
            <td className="nowrap"><button className="btn-icone" onClick={() => mover(i, -1)} aria-label="Subir">↑</button><button className="btn-icone" onClick={() => mover(i, 1)} aria-label="Descer">↓</button></td>
            <td><input value={e.nome} onChange={(ev) => setLista(lista.map((x) => (x.id === e.id ? { ...x, nome: ev.target.value } : x)))} onBlur={() => { salvar(e); base.recarregar() }} /></td>
            <td><input type="color" value={e.cor ?? '#c9a45c'} onChange={(ev) => { const x = { ...e, cor: ev.target.value }; setLista(lista.map((y) => (y.id === e.id ? x : y))); salvar(x) }} /></td>
            <td><select value={e.final ?? ''} onChange={(ev) => { const x = { ...e, final: (ev.target.value || null) as Etapa['final'] }; setLista(lista.map((y) => (y.id === e.id ? x : y))); salvar(x) }}>
              <option value="">Não</option><option value="ganho">Ganho (comprou)</option><option value="perdido">Perdido</option></select></td>
            <td><button className="link pequeno" onClick={() => apagar(e.id)}>remover</button></td>
          </tr>
        ))}</tbody>
      </table>
      <Erro msg={erro} />
      <button className="btn btn-mini mt" onClick={nova}>+ Etapa</button>
    </section>
  )
}

function Respostas({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [atalho, setAtalho] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const add = async () => {
    const { error } = await supabase.from('crm_respostas').insert({ empresa_id: empresaId, atalho: atalho.trim().replace(/^\//, ''), texto })
    if (error) return setErro(error.message.includes('duplicate') ? 'Já existe esse atalho.' : error.message)
    setAtalho(''); setTexto(''); base.recarregar()
  }
  const apagar = async (id: string) => { await supabase.from('crm_respostas').delete().eq('id', id); base.recarregar() }
  return (
    <section className="bloco">
      <p className="muted">Textos que a equipe usa sempre. Na conversa, digite <b>/</b> e o atalho para colar.</p>
      <ul className="lista-compras">{base.respostas.map((r) => <li key={r.id}><span><b>/{r.atalho}</b> <button className="link pequeno" onClick={() => apagar(r.id)}>remover</button></span><span className="muted pequeno">{r.texto}</span></li>)}</ul>
      <div className="form-grade mt">
        <Campo rotulo="Atalho"><input value={atalho} onChange={(e) => setAtalho(e.target.value)} placeholder="pix" /></Campo>
        <Campo rotulo="Texto"><textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
      </div>
      <Erro msg={erro} />
      <button className="btn btn-mini" onClick={add} disabled={!atalho.trim() || !texto.trim()}>Adicionar</button>
    </section>
  )
}

const EVENTO: Record<string, string> = {
  compra_aprovada: 'Compra aprovada', aguardando_pagamento: 'Pix ou boleto gerado', carrinho_abandonado: 'Carrinho abandonado',
  reembolso: 'Reembolso', pagamento_expirou: 'Pagamento expirou', compra_cancelada: 'Compra cancelada',
}
const ACAO: Record<string, string> = {
  marcar_ganho: 'marca como Comprou e para os follow-ups', iniciar_cadencia: 'começa o follow-up', parar_cadencias: 'para os follow-ups',
  criar_tarefa: 'cria a tarefa', etiqueta: 'põe a etiqueta', mover_etapa: 'muda a etapa',
}
type Regra = { id: string; evento: string; acao: string; parametros: Record<string, string>; ativa: boolean }

function Followups({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [regras, setRegras] = useState<Regra[]>([])
  const [ed, setEd] = useState<Cadencia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { supabase.from('crm_regras').select('*').eq('empresa_id', empresaId).order('evento').order('ordem').then(({ data }) => setRegras((data as Regra[]) ?? [])) }, [empresaId])
  const salvar = async (c: Cadencia) => {
    const reg = { empresa_id: empresaId, nome: c.nome, passos: c.passos, ativa: c.ativa, tipo_tarefa: c.tipo_tarefa }
    const { error } = c.id ? await supabase.from('crm_cadencias').update(reg).eq('id', c.id) : await supabase.from('crm_cadencias').insert(reg)
    if (error) return setErro(error.message)
    setEd(null); base.recarregar()
  }
  const passo = (i: number, campo: keyof Passo, v: string) => ed && setEd({ ...ed, passos: ed.passos.map((p, j) => (j === i ? { ...p, [campo]: campo === 'apos_horas' ? Number(v) * 24 : v } : p)) })
  return (
    <section>
      <p className="muted">Sequências de passos com prazo. Cada passo vira uma tarefa para a dona do contato (ou uma mensagem automática). Tudo para sozinho quando a pessoa responde, compra ou é marcada como perdida.</p>
      <div className="cards">
        {base.cadencias.map((c) => (
          <div key={c.id} className="card-lista">
            <div className="card-lista-topo"><h3>{c.nome}</h3>{!c.ativa && <span className="muted pequeno">desligado</span>}</div>
            <ol className="pequeno lista-passos">{c.passos.map((p, i) => <li key={i}><b>Dia {Math.round(p.apos_horas / 24)}</b> · {p.tipo === 'mensagem' ? 'mensagem automática' : 'tarefa'}: {p.titulo ?? p.texto}</li>)}</ol>
            <div className="acoes"><button className="btn btn-mini" onClick={() => setEd(c)}>Ajustar</button></div>
          </div>
        ))}
      </div>
      <button className="btn btn-contorno mt" onClick={() => setEd({ id: '', nome: 'Novo follow-up', passos: [{ apos_horas: 0, tipo: 'tarefa', titulo: 'Primeiro contato' }], ativa: true, tipo_tarefa: 'follow_up' })}>+ Novo follow-up</button>

      <h3 className="mt">O que acontece sozinho</h3>
      <ul className="lista-compras">{regras.map((r) => (
        <li key={r.id}><span className="pequeno"><b>{EVENTO[r.evento] ?? r.evento}</b> → {ACAO[r.acao] ?? r.acao}{r.acao === 'iniciar_cadencia' ? ` “${base.cadencias.find((c) => c.id === r.parametros.cadencia_id)?.nome ?? ''}”` : r.parametros.titulo ? ` “${r.parametros.titulo}”` : r.parametros.tag ? ` “${r.parametros.tag}”` : ''}</span></li>
      ))}</ul>

      {ed && (
        <Modal titulo={ed.id ? `Ajustar ${ed.nome}` : 'Novo follow-up'} aberto onFechar={() => setEd(null)} largo>
          <div className="form-grade">
            <Campo rotulo="Nome"><input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Ligado"><select value={ed.ativa ? 's' : 'n'} onChange={(e) => setEd({ ...ed, ativa: e.target.value === 's' })}><option value="s">Sim</option><option value="n">Não</option></select></Campo>
          </div>
          {ed.passos.map((p, i) => (
            <div key={i} className="editor-msg">
              <div className="nova-tarefa-linha">
                <span className="pequeno">Dia</span><input type="number" min={0} style={{ width: 70 }} value={Math.round(p.apos_horas / 24)} onChange={(e) => passo(i, 'apos_horas', e.target.value)} />
                <select value={p.tipo} onChange={(e) => passo(i, 'tipo', e.target.value)}><option value="tarefa">Tarefa para a vendedora</option><option value="mensagem">Mensagem automática</option></select>
                {ed.passos.length > 1 && <button className="link pequeno" onClick={() => setEd({ ...ed, passos: ed.passos.filter((_, j) => j !== i) })}>remover</button>}
              </div>
              {p.tipo === 'tarefa' && <input value={p.titulo ?? ''} onChange={(e) => passo(i, 'titulo', e.target.value)} placeholder="O que fazer (aparece na fila)" />}
              <textarea rows={2} value={p.texto ?? ''} onChange={(e) => passo(i, 'texto', e.target.value)} placeholder={p.tipo === 'mensagem' ? 'Texto da mensagem ({nome}, {produto}, {link_pagamento})' : 'Dica para a vendedora (opcional)'} />
            </div>
          ))}
          <button className="btn btn-mini" onClick={() => setEd({ ...ed, passos: [...ed.passos, { apos_horas: (ed.passos.at(-1)?.apos_horas ?? 0) + 24, tipo: 'tarefa', titulo: '' }] })}>+ passo</button>
          <Erro msg={erro} />
          <div className="modal-acoes"><button className="btn" onClick={() => setEd(null)}>Cancelar</button><button className="btn btn-ouro" onClick={() => salvar(ed)}>Salvar</button></div>
        </Modal>
      )}
    </section>
  )
}

function Motivos({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [novo, setNovo] = useState('')
  const add = async () => { if (!novo.trim()) return; await supabase.from('crm_motivos_perda').insert({ empresa_id: empresaId, nome: novo.trim(), ordem: base.motivos.length + 1 }); setNovo(''); base.recarregar() }
  const tirar = async (nome: string) => { await supabase.from('crm_motivos_perda').delete().eq('empresa_id', empresaId).eq('nome', nome); base.recarregar() }
  return (
    <section className="bloco">
      <p className="muted">Para marcar um contato como perdido, a pessoa escolhe um destes. O painel mostra quais aparecem mais.</p>
      <ul className="lista-compras">{base.motivos.map((m) => <li key={m}><span>{m} <button className="link pequeno" onClick={() => tirar(m)}>remover</button></span></li>)}</ul>
      <div className="nova-tarefa-linha mt"><input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo motivo" /><button className="btn btn-mini" onClick={add}>Adicionar</button></div>
    </section>
  )
}
