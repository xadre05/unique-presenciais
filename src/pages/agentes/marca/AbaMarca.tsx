// Base da marca → A marca: seções que abrem e fecham (sobre, voz, limites, produtos e condições, pessoas, visual)
// e o resumo ao lado. Os textos são editados juntos e salvos de uma vez pela barra de baixo; fotos e logos são
// guardados assim que enviados. Com alteração não salva, a página avisa antes de sair.
import { useEffect, useState } from 'react'
import { msgErro } from '../../../lib/dados'
import { Campo, Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { PessoasMarca, usePessoasMarca } from '../PessoasMarca'
import { LogosMarca } from '../LogosMarca'
import { Secao } from './Secao'
import { VozMarca } from './VozMarca'
import { ResumoMarca } from './ResumoMarca'
import { iguais, primeiraFrase, salvarTextos, seloDe, textosDe, type Textos } from './dados'

type Props = { empresa: string; perfil: Record<string, unknown>; aoSalvar: () => void; aoMudarPendente: (p: boolean) => void }

function useAvisoAoSair(pendente: boolean) {
  useEffect(() => {
    if (!pendente) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendente])
}

export function AbaMarca({ empresa, perfil, aoSalvar, aoMudarPendente }: Props) {
  const pessoas = usePessoasMarca(empresa)
  const [base, setBase] = useState<Textos>(() => textosDe(perfil))
  const [t, setT] = useState<Textos>(base)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pendente = !iguais(t, base)
  useEffect(() => { aoMudarPendente(pendente) }, [pendente, aoMudarPendente])
  useAvisoAoSair(pendente)

  const mudar = (c: Partial<Textos>) => { setT((v) => ({ ...v, ...c })); setSalvo(false) }
  const campo = (k: keyof Textos) => ({ value: t[k], onChange: (e: { target: { value: string } }) => mudar({ [k]: e.target.value }) })
  const salvar = async () => {
    setErro(null); setSalvando(true)
    const { error } = await salvarTextos(empresa, t)
    setSalvando(false)
    if (error) return setErro(msgErro(error))
    setBase(t); setSalvo(true); aoSalvar()
  }
  const lista = pessoas.dados ?? []

  return (
    <div className="bm-grade">
      <div className="bm-principal">
        <Secao titulo="Sobre a marca" icone="livro" aberta selo={seloDe(!!(t.empresa.trim() && t.o_que_vende.trim() && t.publico.trim()))} resumo={primeiraFrase(t.empresa)}>
          <div className="bm-campos">
            <Campo rotulo="Quem é a marca" dica="O nome e o que ela é, em uma frase."><input {...campo('empresa')} /></Campo>
            <div className="bm-duas">
              <Campo rotulo="O que vende sempre" dica="Produtos, cursos ou procedimentos e o que cada um entrega. Oferta com data (Black, lançamento) vai em Campanhas."><textarea rows={6} {...campo('o_que_vende')} /></Campo>
              <Campo rotulo="Para quem" dica="Quem compra e o que essa pessoa quer."><textarea rows={6} {...campo('publico')} /></Campo>
            </div>
          </div>
        </Secao>
        <Secao titulo="Voz da marca" icone="mensagem" selo={seloDe(!!(t.tom.trim() || t.voz.trim()))} resumo={t.tom.trim() || primeiraFrase(t.voz)}>
          <VozMarca empresa={empresa} tom={t.tom} voz={t.voz} aoMudar={mudar} />
        </Secao>
        <Secao titulo="Limites e orientações" icone="alerta" selo={seloDe(!!(t.evitar.trim() && t.conselho.trim()))} resumo="O que nunca fazer e as regras do conselho">
          <div className="bm-duas">
            <Campo rotulo="Nunca fazer" dica="Palavras e promessas proibidas."><textarea rows={6} {...campo('evitar')} /></Campo>
            <Campo rotulo="Regras do conselho" dica="CFO, CFM, CRBM: o que a publicidade não pode ter."><textarea rows={6} {...campo('conselho')} /></Campo>
          </div>
        </Secao>
        <Secao titulo="Produtos e condições fixas" icone="sacola" selo={seloDe(!!t.materiais.trim())} resumo="Preços, formas de pagamento e perguntas frequentes do que a marca vende sempre">
          <Campo rotulo="Condições fixas (fonte da verdade)" dica="Preço, acesso, formas de pagamento e perguntas frequentes. O que é de uma campanha fica na campanha. O agente não inventa nada fora daqui.">
            <textarea rows={12} {...campo('materiais')} /></Campo>
        </Secao>
        <Secao titulo="Pessoas da marca" icone="equipe" selo={lista.some((p) => p.autorizado) ? { texto: 'Autorizado', tom: 'ok' } : seloDe(false)}
          resumo={lista.length ? `${lista.map((p) => p.nome).join(', ')} · ${lista.reduce((s, p) => s + p.fotos.length, 0)} foto(s)` : 'Ninguém cadastrado'}>
          <p className="muted pequeno">Quem pode aparecer nas artes criadas pela IA. As fotos servem de referência para o rosto ficar parecido; só entram com a autorização de uso de imagem. Fotos são guardadas assim que enviadas.</p>
          <PessoasMarca empresa={empresa} aoMudar={pessoas.recarregar} />
        </Secao>
        <Secao titulo="Identidade visual" icone="imagem" selo={seloDe(Array.isArray(perfil.logos) && perfil.logos.length > 0)} resumo="Logos e referências de estilo">
          <p className="muted pequeno">O logo real e imagens que mostram o estilo da marca. O Agente de Arte usa em toda arte. Imagens são guardadas assim que enviadas.</p>
          <div className="bm-logos"><LogosMarca empresaId={empresa} perfil={perfil} aoSalvar={aoSalvar} /></div>
        </Secao>
      </div>
      <ResumoMarca textos={t} perfil={perfil} pessoas={lista} />
      {(pendente || salvo || erro) && (
        <div className={`bm-barra${pendente ? ' pendente' : ''}`}>
          {pendente ? <span><span className="bm-ponto" /> <b>Alterações não salvas.</b> <span className="muted">Passam a valer nas próximas tarefas dos agentes.</span></span>
            : <span className="ok-txt"><Icone nome="check" tam={16} /> Alterações salvas.</span>}
          <Erro msg={erro} />
          {pendente && <span className="ia-linha">
            <button type="button" className="btn btn-contorno-ouro" disabled={salvando} onClick={() => setT(base)}>Descartar</button>
            <button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
          </span>}
        </div>
      )}
    </div>
  )
}
