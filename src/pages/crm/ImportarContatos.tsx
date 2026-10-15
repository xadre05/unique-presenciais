// Importar contatos: lista do SellFlux, exportação de vendas da Hotmart ou planilha com nome e WhatsApp.
import { useState } from 'react'
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
  const [fim, setFim] = useState<{ novos: number; atualizados: number; ignorados: number } | null>(null)

  const ler = async (f: File | undefined) => {
    setErro(null); setLeitura(null); setFim(null)
    if (!f) return
    setArquivo(f.name)
    try {
      const buf = await f.arrayBuffer()
      let txt = new TextDecoder('utf-8').decode(buf)
      if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf)   // planilha salva no Excel antigo
      setLeitura(lerArquivoContatos(txt))
    } catch (e) { setErro((e as Error).message) }
  }

  const importar = async () => {
    if (!leitura) return
    setErro(null); setProg([0, leitura.linhas.length])
    try {
      const r = await importarContatos(EMPRESA_UNIQUE, leitura.linhas, leitura.tipo, (a, b) => setProg([a, b]))
      setProg(null)
      await supabase.rpc('atualizar_resumo_contatos')
      setFim(r); onFeito()
    } catch (e) { setErro((e as Error).message); setProg(null) }
  }

  const descartados = leitura ? Object.values(leitura.descartes).reduce((s, n) => s + n, 0) : 0
  return (
    <Modal titulo="Importar contatos" aberto onFechar={onFechar} largo>
      {!fim && (<>
        <p className="muted">Aceita a <b>lista de leads do SellFlux</b>, a <b>exportação de vendas da Hotmart</b> ou uma planilha (CSV) com colunas de nome e WhatsApp. Nada que já está na base é apagado: quem já existe só ganha os dados que faltavam.</p>
        <label className="campo">
          <span className="campo-rotulo">Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => ler(e.target.files?.[0])} disabled={!!prog} />
        </label>
      </>)}
      <Erro msg={erro} />

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
          {prog ? (
            <div className="progresso"><div style={{ width: `${(100 * prog[0]) / Math.max(1, prog[1])}%` }} /><span>{prog[0].toLocaleString('pt-BR')} de {prog[1].toLocaleString('pt-BR')}…</span></div>
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
            {fim.ignorados > 0 && <li className="muted">{fim.ignorados.toLocaleString('pt-BR')} sem telefone nem e-mail válidos</li>}
          </ul>
          <p className="muted pequeno">As compras da Hotmart já foram cruzadas: os tipos (comprador, quase comprou...) estão atualizados.</p>
        </div>
        <div className="modal-acoes"><button className="btn btn-ouro" onClick={onFechar}>Fechar</button></div>
      </>)}
    </Modal>
  )
}
