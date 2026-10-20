// Adicionar um material à campanha: pelo link da página (o agente lê o texto), por arquivo (PDF, Word, texto ou a
// página salva .html) ou colando o texto. Sempre mostra o texto lido para conferir e corrigir antes de guardar.
import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Erro, Modal } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { ACEITOS_COM_HTML, lerTexto, tipoDoArquivo, type TipoFonte } from '../biblioteca/lerArquivo'
import { guardarTexto } from '../biblioteca/dados'
import { PAPEIS, LIMITE_MATERIAL, type Papel } from './materiais'

type Jeito = 'link' | 'arquivo' | 'colar'
type Props = { empresa: string; campanha: string; aberto: boolean; aoFechar: () => void; aoGuardar: () => void }

export function AdicionarMaterial({ empresa, campanha, aberto, aoFechar, aoGuardar }: Props) {
  const arquivo = useRef<HTMLInputElement>(null)
  const [jeito, setJeito] = useState<Jeito>('link')
  const [papel, setPapel] = useState<Papel>('pagina')
  const [link, setLink] = useState('')
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState<TipoFonte | 'link'>('texto')
  const [origem, setOrigem] = useState<string | undefined>()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const lerLink = async () => {
    if (!/^https?:\/\//.test(link.trim())) return setErro('Cole o link completo, começando com https://')
    setErro(null); setOcupado('Lendo a página…')
    const { data, error } = await supabase.functions.invoke('agentes', { body: { lerPagina: link.trim() } })
    setOcupado(null)
    if (error || data?.erro) return setErro(data?.erro ?? 'Não consegui ler essa página. Envie o arquivo .html (Ctrl+S na página) ou cole o texto.')
    setTexto(data.texto); setTipo('link'); setOrigem(link.trim())
    if (!titulo) setTitulo(new URL(link.trim()).hostname.replace(/^www\./, ''))
  }
  const lerArquivo = async (f: File | undefined) => {
    if (!f) return
    const t = tipoDoArquivo(f.name)
    if (!t) return setErro('Formato não aceito. Envie PDF, Word (.docx), texto (.txt) ou a página salva (.html).')
    setErro(null); setOcupado('Lendo o arquivo…')
    try { setTexto(await lerTexto(f)); setTipo(t); setOrigem(f.name); if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, '')) } catch (e) { setErro((e as Error).message) }
    setOcupado(null)
    if (arquivo.current) arquivo.current.value = ''
  }
  const guardar = async () => {
    if (!titulo.trim()) return setErro('Dê um nome ao material (ex.: Página de vendas da Black).')
    if (texto.trim().length < 80) return setErro('O texto está vazio ou curto demais.')
    setErro(null); setOcupado('Guardando…')
    try {
      await guardarTexto(empresa, titulo, jeito === 'colar' ? 'texto' : tipo, texto, origem, true, { campanha, papel })
      setLink(''); setTitulo(''); setTexto(''); setOrigem(undefined); setOcupado(null)
      aoGuardar(); aoFechar()
    } catch (e) { setErro((e as Error).message); setOcupado(null) }
  }

  return (
    <Modal titulo="Adicionar material da campanha" aberto={aberto} onFechar={aoFechar} largo>
      <div className="mat-form">
        <label className="pl-rotulo">O que é</label>
        <div className="abas-mini" role="radiogroup">{PAPEIS.map(([id, nome]) => (
          <button key={id} type="button" role="radio" aria-checked={papel === id} className={papel === id ? 'ativa' : ''} onClick={() => setPapel(id)}>{nome}</button>))}</div>
        <label className="pl-rotulo">Como enviar</label>
        <div className="abas-mini" role="radiogroup">{([['link', 'Link da página'], ['arquivo', 'Arquivo'], ['colar', 'Colar texto']] as [Jeito, string][]).map(([id, nome]) => (
          <button key={id} type="button" role="radio" aria-checked={jeito === id} className={jeito === id ? 'ativa' : ''} onClick={() => { setJeito(id); setErro(null) }}>{nome}</button>))}</div>
        {jeito === 'link' && <div className="mat-linha">
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (página de vendas publicada)" aria-label="Link da página" />
          <button type="button" className="btn btn-contorno-ouro" disabled={!!ocupado} onClick={lerLink}><Icone nome="links" tam={15} /> Ler página</button></div>}
        {jeito === 'arquivo' && <div className="mat-linha">
          <button type="button" className="btn btn-contorno-ouro" disabled={!!ocupado} onClick={() => arquivo.current?.click()}><Icone nome="importar" tam={15} /> Escolher arquivo</button>
          <span className="muted pequeno">PDF, Word, .txt ou a página salva no computador (.html)</span>
          <input ref={arquivo} type="file" accept={ACEITOS_COM_HTML} hidden onChange={(e) => lerArquivo(e.target.files?.[0])} /></div>}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nome do material (ex.: Roteiro do VSL da Black)" aria-label="Nome do material" />
        <textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto do material"
          placeholder={jeito === 'colar' ? 'Cole aqui o roteiro, a copy ou o texto da página.' : 'O texto lido aparece aqui para você conferir e corrigir antes de guardar.'} />
        {texto.length > LIMITE_MATERIAL && <p className="bib-aviso pequeno"><Icone nome="alerta" tam={14} /> Texto longo ({texto.length.toLocaleString('pt-BR')} caracteres). O agente lê os primeiros {LIMITE_MATERIAL.toLocaleString('pt-BR')} de cada material: corte o que não importa (rodapé, termos) ou divida em dois.</p>}
        {ocupado && <p className="muted pequeno">{ocupado}</p>}
        <Erro msg={erro} />
        <div className="modal-acoes">
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn btn-ouro" disabled={!!ocupado || !texto.trim()} onClick={guardar}>Guardar na campanha</button>
        </div>
      </div>
    </Modal>
  )
}
