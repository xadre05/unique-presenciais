// "Materiais da campanha": o que já está pronto (página de vendas, roteiros dos vídeos, copy). O agente lê esses
// textos inteiros em tudo que cria para a campanha, para usar a mesma oferta, promessa e palavras.
import { useState } from 'react'
import { dataBR } from '../../../lib/format'
import { Badge, Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { textoDaFonte, tirarFonte, useMateriais, type Material } from '../biblioteca/dados'
import { NOME_PAPEL, type Papel } from './materiais'
import { AdicionarMaterial } from './AdicionarMaterial'

function Item({ m, aoTirar }: { m: Material; aoTirar: () => void }) {
  const [texto, setTexto] = useState<string | null>(null)
  const ver = async () => setTexto(texto === null ? await textoDaFonte(m.id) : null)
  return (
    <li className="bib-fonte">
      <div className="bib-fonte-linha">
        <span className="bib-fonte-ico"><Icone nome={m.tipo === 'link' ? 'links' : 'documento'} tam={18} /></span>
        <span className="bib-fonte-txt"><b>{m.titulo}</b>
          <small>{NOME_PAPEL[(m.papel ?? 'outro') as Papel] ?? 'Material'} · {m.caracteres.toLocaleString('pt-BR')} caracteres · {dataBR(m.criado_em.slice(0, 10))}</small></span>
        {m.status !== 'pronta' && <Badge tom={m.status === 'erro' ? 'erro' : 'alerta'}>{m.status === 'erro' ? 'Falhou' : 'Processando'}</Badge>}
        <button type="button" className="btn btn-mini" onClick={ver}>{texto === null ? 'Ver texto' : 'Fechar'}</button>
        <button type="button" className="btn btn-mini" onClick={aoTirar} title="Tirar da campanha (o agente para de usar)"><Icone nome="lixeira" tam={14} /></button>
      </div>
      {texto !== null && <pre className="mat-texto">{texto}</pre>}
    </li>
  )
}

export function MateriaisCampanha({ empresa, campanha }: { empresa: string; campanha: string }) {
  const mats = useMateriais(empresa, campanha)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const tirar = async (m: Material) => {
    if (!window.confirm(`Tirar "${m.titulo}" da campanha? O agente para de usar este material.`)) return
    const { error } = await tirarFonte(m.id)
    if (error) setErro(error.message); else mats.recarregar()
  }
  const lista = mats.dados ?? []
  return (
    <section className="camp-detalhe">
      <div className="camp-cab">
        <div><h3 className="camp-titulo">Materiais da campanha</h3>
          <p className="muted pequeno">Página de vendas, roteiros dos vídeos e copy já prontos. O agente lê tudo isso em cada peça que criar desta campanha.</p></div>
        <button type="button" className="btn btn-ouro btn-mini" onClick={() => setAberto(true)}><Icone nome="mais" tam={14} /> Adicionar material</button>
      </div>
      <Erro msg={mats.erro || erro} />
      {mats.carregando && !mats.dados ? <p className="muted pequeno">Carregando…</p>
        : lista.length ? <ul className="bib-fontes">{lista.map((m) => <Item key={m.id} m={m} aoTirar={() => tirar(m)} />)}</ul>
        : <p className="muted pequeno">Nenhum material ainda. Comece pela página de vendas (o link ou o arquivo salvo) e pelos roteiros dos vídeos.</p>}
      <AdicionarMaterial empresa={empresa} campanha={campanha} aberto={aberto} aoFechar={() => setAberto(false)} aoGuardar={mats.recarregar} />
    </section>
  )
}
