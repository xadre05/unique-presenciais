// Importar contatos: lista do SellFlux, exportação de vendas da Hotmart ou planilha com nome e WhatsApp.
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Erro, Modal } from '../../components/ui'
import { importarContatos } from '../../crm/nucleo'
import { EMPRESA_UNIQUE, lerArquivoContatos, type Leitura } from './comum'

const TIPO: Record<Leitura['tipo'], string> = {
  sellflux: 'Lista de leads do SellFlux',
  hotmart: 'Exportação de vendas da Hotmart',
  planilha: 'Planilha de contatos',
}

export default function ImportarContatos({ onFechar, onFeito }: { onFechar: () => void; onFeito: () => void }) {
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [arquivo, setArquivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [prog, setProg] = useState<[number, number] | null>(null)
  const [fim, setFim] = useState<{ novos: number; atualizados: number; ignorados: number; avisoResumo?: string } | null>(null)
  // etapa em andamento: enquanto houver uma, a tela mostra o que está acontecendo e não deixa importar de novo
  const [etapa, setEtapa] = useState<'lendo' | 'enviando' | 'cruzando' | null>(null)
  const rodando = useRef(false)

  const ler = async (f: File | undefined) => {
    setErro(null); setLeitura(null); setFim(null)
    if (!f) return
    setArquivo(f.name)
    setEtapa('lendo')
    try {
      const buf = await f.arrayBuffer()
      let txt = new TextDecoder('utf-8').decode(buf)
      if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf)   // planilha salva no Excel antigo
      setLeitura(lerArquivoContatos(txt))
    } catch (e) { setErro((e as Error).message) }
    setEtapa(null)
  }

  const importar = async () => {
    if (!leitura || rodando.current) return
    rodando.current = true
    setErro(null); setProg([0, leitura.linhas.length]); setEtapa('enviando')
    try {
      const r = await importarContatos(EMPRESA_UNIQUE, leitura.linhas, leitura.tipo, (a, b) => setProg([a, b]))
      setEtapa('cruzando')
      const { error } = await supabase.rpc('atualizar_resumo_contatos')
      setFim({ ...r, avisoResumo: error ? 'Os contatos entraram, mas o cruzamento com as compras não terminou. Ele roda de novo sozinho na próxima atualização da Hotmart.' : undefined }); onFeito()
    } catch (e) { setErro(`${(e as Error).message} — o que já foi enviado ficou salvo; importar de novo não duplica.`) }
    setProg(null); setEtapa(null); rodando.current = false
  }
  const ocupado = etapa !== null

  const descartados = leitura ? Object.values(leitura.descartes).reduce((s, n) => s + n, 0) : 0
  return (
    <Modal titulo="Importar contatos" aberto onFechar={ocupado ? () => undefined : onFechar} largo>
      {!fim && (<>
        <p className="muted">Aceita a <b>lista de leads do SellFlux</b>, a <b>exportação de vendas da Hotmart</b> ou uma planilha (CSV) com colunas de nome e WhatsApp. Nada que já está na base é apagado: quem já existe só ganha os dados que faltavam.</p>
        <label className="campo">
          <span className="campo-rotulo">Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => ler(e.target.files?.[0])} disabled={ocupado} />
        </label>
      </>)}
      <Erro msg={erro} />
      {etapa === 'lendo' && <div className="progresso"><div className="indeterminado" /><span>Lendo o arquivo…</span></div>}

      {leitura && !fim && (
        <div className="importar-previa">
          <div><b>{TIPO[leitura.tipo]}</b> <span className="muted pequeno">· {arquivo}</span></div>
          <ul>
            <li>{leitura.lidas.toLocaleString('pt-BR')} linhas no arquivo</li>
            <li className="ok-txt"><b>{leitura.linhas.length.toLocaleString('pt-BR')}</b> {leitura.tipo === 'hotmart' ? 'pessoas' : 'contatos aproveitáveis'}
              {leitura.tipo === 'hotmart' && <> ({(leitura.compradores ?? 0).toLocaleString('pt-BR')} compraram · {(leitura.quase ?? 0).toLocaleString('pt-BR')} quase compraram)</>}</li>
            {descartados > 0 && <li>{descartados.toLocaleString('pt-BR')} {leitura.tipo === 'hotmart' ? 'linhas sem contato' : 'descartados ou juntados'}:
              <ul>{Object.entries(leitura.descartes).sort((a, b) => b[1] - a[1]).map(([m, n]) => <li key={m} className="muted">{n.toLocaleString('pt-BR')} — {m}</li>)}</ul></li>}
          </ul>
          {etapa === 'enviando' && prog ? (
            <div className="progresso"><div style={{ width: `${(100 * prog[0]) / Math.max(1, prog[1])}%` }} /><span>Etapa 1 de 2 · enviando {prog[0].toLocaleString('pt-BR')} de {prog[1].toLocaleString('pt-BR')} contatos… não feche esta janela</span></div>
          ) : etapa === 'cruzando' ? (
            <div className="progresso"><div className="indeterminado" /><span>Etapa 2 de 2 · cruzando com as compras da Hotmart e os alunos (até 20 segundos)… não feche esta janela</span></div>
          ) : (
            <div className="modal-acoes">
              <button className="btn" onClick={onFechar}>Cancelar</button>
              <button className="btn btn-ouro" onClick={importar} disabled={!leitura.linhas.length}>Importar {leitura.linhas.length.toLocaleString('pt-BR')}</button>
            </div>
          )}
        </div>
      )}

      {fim && (<>
        <div className="importar-previa">
          <b className="ok-txt">Importação concluída</b>
          <ul>
            <li><b>{fim.novos.toLocaleString('pt-BR')}</b> contatos novos</li>
            <li><b>{fim.atualizados.toLocaleString('pt-BR')}</b> já existiam e foram completados (telefone, e-mail, etiquetas)</li>
            {fim.avisoResumo && <li className="erro-txt">{fim.avisoResumo}</li>}
            {fim.ignorados > 0 && <li className="muted">{fim.ignorados.toLocaleString('pt-BR')} sem telefone nem e-mail válidos</li>}
          </ul>
          <p className="muted pequeno">As compras da Hotmart já foram cruzadas: os tipos (comprador, quase comprou...) estão atualizados.</p>
        </div>
        <div className="modal-acoes"><button className="btn btn-ouro" onClick={onFechar}>Fechar</button></div>
      </>)}
    </Modal>
  )
}
