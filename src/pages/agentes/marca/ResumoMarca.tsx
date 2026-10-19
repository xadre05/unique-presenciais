// Coluna ao lado da aba A marca: o que os agentes estão entendendo da marca, em poucas linhas, e os logos inteiros.
// Mostra o texto que está na tela (mesmo antes de salvar), para a equipe conferir o efeito do que escreveu.
import { useEffect, useState } from 'react'
import { Icone } from '../../../components/Icone'
import { linkDe } from '../marketing/peca/arquivos'
import { logosDe, NOME_USO } from '../LogosMarca'
import type { PessoaMarca } from '../PessoasMarca'
import { primeiraFrase, type Textos } from './dados'

type Campanha = { nome: string; inicio?: string; fim?: string; encerrada?: boolean }
type Props = { textos: Textos; perfil: Record<string, unknown>; pessoas: PessoaMarca[] }

function Logo({ caminho, legenda, claro }: { caminho: string; legenda: string; claro?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let vivo = true; linkDe(caminho).then((u) => vivo && setUrl(u)); return () => { vivo = false } }, [caminho])
  return <figure className={`bm-logo${claro ? ' claro' : ''}`}>{url ? <img src={url} alt={legenda} /> : <span className="muted pequeno">Carregando…</span>}<figcaption>{legenda}</figcaption></figure>
}

function campanhaAtiva(perfil: Record<string, unknown>) {
  const hoje = new Date().toISOString().slice(0, 10)
  const lista = (Array.isArray(perfil.campanhas) ? perfil.campanhas : []) as Campanha[]
  return lista.find((c) => !c.encerrada && (!c.inicio || c.inicio <= hoje) && (!c.fim || c.fim >= hoje))
}

export function ResumoMarca({ textos, perfil, pessoas }: Props) {
  const camp = campanhaAtiva(perfil)
  const logos = logosDe(perfil)
  const linhas: [string, string, string][] = [
    ['usuario', 'Marca', primeiraFrase(textos.empresa, 70) || '—'],
    ['contatos', 'Público', primeiraFrase(textos.publico, 70) || '—'],
    ['mensagem', 'Tom', textos.tom.trim() || '—'],
    ['equipe', 'Quem aparece', pessoas.filter((p) => p.autorizado).map((p) => p.papel ? `${p.nome} (${p.papel})` : p.nome).join(', ') || '—'],
    ['floco', 'Campanha hoje', camp ? camp.nome : 'nenhuma'],
  ]
  return (
    <aside className="bm-lado">
      <section className="bm-cartao">
        <h3><Icone nome="documento" tam={20} /> Resumo para os agentes</h3>
        <dl className="bm-resumo">{linhas.map(([icone, rotulo, valor]) => (
          <div key={rotulo}><dt><Icone nome={icone} tam={16} /> {rotulo}</dt><dd>{valor}</dd></div>))}</dl>
      </section>
      <section className="bm-cartao">
        <h3><Icone nome="imagem" tam={20} /> Logos</h3>
        {logos.length ? logos.map((l) => <Logo key={l.caminho} caminho={l.caminho} claro={l.uso === 'claro'} legenda={l.uso ? NOME_USO[l.uso] : 'Qualquer fundo'} />)
          : <p className="muted pequeno">Nenhum logo enviado. Sem logo, as artes saem sem logotipo.</p>}
      </section>
    </aside>
  )
}
