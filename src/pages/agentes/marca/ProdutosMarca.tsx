// Produtos que a marca vende sempre, cada um com o que entrega, acesso, preço, pagamento, link e regras.
// É a fonte da verdade de preço fora das campanhas. Turmas, datas e vagas dos cursos presenciais vêm do Comercial.
import { useState } from 'react'
import { Campo } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { CampoDinheiro } from './CampoDinheiro'
import { NOME_TIPO, novoProduto, precoDe, type Produto, type TipoProduto } from './dados'

type Props = { produtos: Produto[]; aoMudar: (p: Produto[]) => void }

function FormProduto({ p, aoMudar }: { p: Produto; aoMudar: (x: Partial<Produto>) => void }) {
  const texto = (k: 'nome' | 'entrega' | 'para_quem' | 'acesso' | 'pagamento' | 'link' | 'regras') => ({ value: p[k] ?? '', onChange: (e: { target: { value: string } }) => aoMudar({ [k]: e.target.value }) })
  return (
    <div className="bm-campos bm-produto-form">
      <div className="bm-duas">
        <Campo rotulo="Nome"><input {...texto('nome')} placeholder="Ex.: Plataforma Unique HOF Academy" /></Campo>
        <Campo rotulo="Tipo"><select value={p.tipo} onChange={(e) => aoMudar({ tipo: e.target.value as TipoProduto })}>{(Object.keys(NOME_TIPO) as TipoProduto[]).map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}</select></Campo>
      </div>
      <Campo rotulo="O que entrega" dica="O que a pessoa recebe, em poucas linhas."><textarea rows={4} {...texto('entrega')} /></Campo>
      <div className="bm-duas">
        <Campo rotulo="Para quem" dica="Se for diferente do público da marca."><input {...texto('para_quem')} /></Campo>
        <Campo rotulo="Acesso ou duração" dica="Ex.: 1 ano de acesso; 3 dias presenciais."><input {...texto('acesso')} /></Campo>
      </div>
      <div className="bm-tres">
        <Campo rotulo="Preço à vista"><CampoDinheiro rotulo="Preço à vista" valor={p.preco_vista} aoMudar={(v) => aoMudar({ preco_vista: v })} /></Campo>
        <Campo rotulo="Parcelas"><input type="number" min={1} max={24} value={p.parcelas ?? ''} onChange={(e) => aoMudar({ parcelas: e.target.value ? Number(e.target.value) : undefined })} /></Campo>
        <Campo rotulo="Valor da parcela"><CampoDinheiro rotulo="Valor da parcela" valor={p.valor_parcela} aoMudar={(v) => aoMudar({ valor_parcela: v })} /></Campo>
      </div>
      <div className="bm-duas">
        <Campo rotulo="Formas de pagamento"><input {...texto('pagamento')} placeholder="Ex.: Pix ou cartão pela Hotmart" /></Campo>
        <Campo rotulo="Link de compra"><input {...texto('link')} placeholder="https://" /></Campo>
      </div>
      <Campo rotulo="Regras e perguntas frequentes" dica="Garantia, troca de data, o que não está incluído."><textarea rows={4} {...texto('regras')} /></Campo>
      <label className="pp-check"><input type="checkbox" checked={!p.ativo} onChange={(e) => aoMudar({ ativo: !e.target.checked })} /> Fora de venda no momento (o agente não oferece)</label>
    </div>
  )
}

export function ProdutosMarca({ produtos, aoMudar }: Props) {
  const [aberto, setAberto] = useState<string | null>(null)
  const mudar = (id: string, x: Partial<Produto>) => aoMudar(produtos.map((p) => (p.id === id ? { ...p, ...x } : p)))
  const incluir = () => { const n = novoProduto(); aoMudar([...produtos, n]); setAberto(n.id) }
  return (
    <div className="bm-produtos">
      {produtos.map((p) => (
        <div key={p.id} className={`bm-produto${p.ativo ? '' : ' fora'}`}>
          <div className="bm-produto-cab">
            <button type="button" className="bm-produto-nome" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
              <b>{p.nome.trim() || 'Produto sem nome'}</b>
              <small className="muted">{NOME_TIPO[p.tipo]}{precoDe(p) ? ` · ${precoDe(p)}` : ''}{p.ativo ? '' : ' · fora de venda'}</small>
            </button>
            <button type="button" className="btn btn-mini" onClick={() => setAberto(aberto === p.id ? null : p.id)}><Icone nome="lapis" tam={13} /> {aberto === p.id ? 'Fechar' : 'Editar'}</button>
            <button type="button" className="btn btn-mini" onClick={() => aoMudar(produtos.filter((x) => x.id !== p.id))} aria-label={`Tirar ${p.nome}`}><Icone nome="lixeira" tam={13} /></button>
          </div>
          {aberto === p.id && <FormProduto p={p} aoMudar={(x) => mudar(p.id, x)} />}
        </div>
      ))}
      {!produtos.length && <p className="muted pequeno">Nenhum produto cadastrado. Cadastre o que a marca vende sempre, com preço e condições.</p>}
      <button type="button" className="btn btn-contorno-ouro bm-gerar" onClick={incluir}><Icone nome="mais" tam={15} /> Novo produto</button>
    </div>
  )
}
