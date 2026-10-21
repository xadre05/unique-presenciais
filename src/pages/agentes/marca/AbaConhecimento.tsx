// Base da marca → Conhecimento: a biblioteca da empresa (o que a marca ensina, só aprovados viram fonte),
// o teste de conhecimento e as referências de criação de terceiros (só a forma). "Nova referência" abre em página própria.
import { Icone } from '../../../components/Icone'
import { BibliotecaMarca } from '../biblioteca/BibliotecaMarca'
import { TestarConhecimento } from '../biblioteca/TestarConhecimento'
import { ReferenciasMarca } from '../referencias/ReferenciasMarca'
import { NovaReferencia } from '../referencias/NovaReferencia'
import { NovoCanal } from '../referencias/NovoCanal'
import { CriativosCampeoes } from '../referencias/CriativosCampeoes'
import { useReferencias } from '../referencias/dados'

// pagina = 'nova' (nova referência), 'canal' (estudar um canal) ou nada (a aba)
export type PaginaRef = 'nova' | 'canal' | null
type Props = { empresa: string; pagina: PaginaRef; aoPagina: (p: PaginaRef) => void }

function ComoUsa() {
  return (
    <section className="bm-cartao">
      <h3>Como a biblioteca é usada</h3>
      <ul className="bib-como">
        <li><Icone nome="documento" tam={18} /> Materiais aprovados são a fonte das respostas e dos conteúdos dos agentes.</li>
        <li><Icone nome="relogio" tam={18} /> Materiais a validar ficam guardados, mas fora das fontes, até alguém revisar.</li>
        <li><Icone nome="links" tam={18} /> Cada peça mostra de qual material veio o conteúdo.</li>
      </ul>
    </section>
  )
}

export function AbaConhecimento({ empresa, pagina, aoPagina }: Props) {
  const refs = useReferencias(empresa)
  if (pagina === 'nova') return <NovaReferencia empresa={empresa} aoGuardar={refs.recarregar} aoVoltar={() => aoPagina(null)} />
  if (pagina === 'canal') return <NovoCanal empresa={empresa} aoGuardar={refs.recarregar} aoVoltar={() => aoPagina(null)} />
  return (
    <div className="conh">
      <div className="bm-grade sem-barra">
        <div className="bm-principal"><BibliotecaMarca empresa={empresa} /></div>
        <aside className="bm-lado-col"><ComoUsa /></aside>
      </div>
      <TestarConhecimento empresa={empresa} />
      <CriativosCampeoes empresa={empresa} referencias={refs.dados ?? []} aoMudou={refs.recarregar} />
      <ReferenciasMarca empresa={empresa} lista={refs.dados ?? []} carregando={refs.carregando} erro={refs.erro} aoMudou={refs.recarregar} aoNova={() => aoPagina('nova')} aoCanal={() => aoPagina('canal')} />
    </div>
  )
}
