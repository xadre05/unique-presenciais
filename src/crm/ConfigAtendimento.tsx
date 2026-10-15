// CRM — NÚCLEO: configurações do atendimento (números, etapas do funil, respostas prontas).
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Campo, Erro, InputNumero, Modal } from '../components/ui'
import { STATUS_CANAL, TIPO_CANAL, type BaseCRM, type Canal, type Etapa } from './tipos'

const URL_FUNCAO = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-whatsapp`

export default function ConfigAtendimento({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [aba, setAba] = useState<'numeros' | 'etapas' | 'respostas'>('numeros')
  return (
    <div>
      <nav className="abas">
        <button className={aba === 'numeros' ? 'ativa' : ''} onClick={() => setAba('numeros')}>Números de WhatsApp</button>
        <button className={aba === 'etapas' ? 'ativa' : ''} onClick={() => setAba('etapas')}>Etapas do funil</button>
        <button className={aba === 'respostas' ? 'ativa' : ''} onClick={() => setAba('respostas')}>Respostas prontas</button>
      </nav>
      {aba === 'numeros' && <Numeros empresaId={empresaId} base={base} />}
      {aba === 'etapas' && <Etapas empresaId={empresaId} base={base} />}
      {aba === 'respostas' && <Respostas empresaId={empresaId} base={base} />}
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
