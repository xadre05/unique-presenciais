// Base da marca → A marca: seções que abrem e fecham (sobre, voz, limites, produtos e condições, pessoas, visual)
// e o resumo ao lado. Os textos são editados juntos e salvos de uma vez pela barra de baixo; fotos e logos são
// guardados assim que enviados. Com alteração não salva, a página avisa antes de sair.
import { useEffect, useState } from 'react'
import { msgErro } from '../../../lib/dados'
import { Campo, Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { useAuth } from '../../../auth'
import { PessoasMarca, usePessoasMarca } from '../PessoasMarca'
import { LogosMarca } from '../LogosMarca'
import { BancoImagens, bancoDe } from '../BancoImagens'
import { Secao } from './Secao'
import { VozMarca } from './VozMarca'
import { ResumoMarca } from './ResumoMarca'
import { ProdutosMarca } from './ProdutosMarca'
import { TesteVoz } from './TesteVoz'
import { HistoricoBase } from './HistoricoBase'
import { historicoDe, iguais, primeiraFrase, rascunhoDe, salvarRascunho, seloDe, situacaoDe, type Produto, type Rascunho, type Textos } from './dados'

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
  const { perfil: usuario } = useAuth()
  const [base, setBase] = useState<Rascunho>(() => rascunhoDe(perfil))
  const [r, setR] = useState<Rascunho>(base)
  const t = r.textos
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pendente = !iguais(r, base)
  useEffect(() => { aoMudarPendente(pendente) }, [pendente, aoMudarPendente])
  useAvisoAoSair(pendente)

  const mudar = (c: Partial<Textos>) => { setR((v) => ({ ...v, textos: { ...v.textos, ...c } })); setSalvo(false) }
  const mudarProdutos = (produtos: Produto[]) => { setR((v) => ({ ...v, produtos })); setSalvo(false) }
  const campo = (k: keyof Textos) => ({ value: t[k], onChange: (e: { target: { value: string } }) => mudar({ [k]: e.target.value }) })
  const salvar = async () => {
    setErro(null); setSalvando(true)
    const { error } = await salvarRascunho(empresa, r, base, usuario?.nome || usuario?.email || 'Equipe')
    setSalvando(false)
    if (error) return setErro(msgErro(error))
    setBase(r); setSalvo(true); aoSalvar()
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
            <Campo rotulo="Diferenciais" dica="Por que escolher esta marca e não outra: método, experiência, acompanhamento, resultados que dá para provar."><textarea rows={3} {...campo('diferenciais')} /></Campo>
          </div>
        </Secao>
        <Secao titulo="Voz da marca" icone="mensagem" selo={seloDe(!!(t.tom.trim() || t.voz.trim()))} resumo={t.tom.trim() || primeiraFrase(t.voz)}>
          <VozMarca empresa={empresa} tom={t.tom} voz={t.voz} aoMudar={mudar} />
          <TesteVoz empresa={empresa} rascunho={r} />
        </Secao>
        <Secao titulo="Limites e orientações" icone="alerta" selo={seloDe(!!(t.evitar.trim() && t.conselho.trim()))} resumo="O que nunca fazer e as regras do conselho">
          <div className="bm-duas">
            <Campo rotulo="Nunca fazer" dica="Palavras e promessas proibidas."><textarea rows={6} {...campo('evitar')} /></Campo>
            <Campo rotulo="Regras do conselho" dica="CFO, CFM, CRBM: o que a publicidade não pode ter."><textarea rows={6} {...campo('conselho')} /></Campo>
          </div>
        </Secao>
        <Secao titulo="Produtos e condições" icone="sacola" selo={seloDe(r.produtos.some((p) => situacaoDe(p) === 'venda' && p.nome.trim()))}
          resumo={r.produtos.length ? r.produtos.map((p) => p.nome || 'sem nome').join(', ') : 'Nenhum produto cadastrado'}>
          <p className="muted pequeno">O que a marca vende sempre, com preço e condições: é daqui que o agente tira valores, fora das campanhas. Turmas, datas e vagas dos cursos presenciais vêm do Comercial.</p>
          <ProdutosMarca produtos={r.produtos} aoMudar={mudarProdutos} />
          <Campo rotulo="Condições gerais e perguntas frequentes" dica="O que vale para todos os produtos: garantia, formas de pagamento, como funciona o acesso.">
            <textarea rows={6} {...campo('materiais')} /></Campo>
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
        <Secao titulo="Banco de imagens para vídeos" icone="video" selo={seloDe(bancoDe(perfil).length > 0)} resumo={`${bancoDe(perfil).length} imagem(ns) e clipe(s)`}>
          <BancoImagens empresaId={empresa} perfil={perfil} aoSalvar={aoSalvar} />
        </Secao>
      </div>
      <div className="bm-lado-col">
        <ResumoMarca textos={t} perfil={perfil} pessoas={lista} />
        <HistoricoBase lista={historicoDe(perfil)} />
      </div>
      {(pendente || salvo || erro) && (
        <div className={`bm-barra${pendente ? ' pendente' : ''}`}>
          {pendente ? <span><span className="bm-ponto" /> <b>Alterações não salvas.</b> <span className="muted">Passam a valer nas próximas tarefas dos agentes.</span></span>
            : <span className="ok-txt"><Icone nome="check" tam={16} /> Alterações salvas.</span>}
          <Erro msg={erro} />
          {pendente && <span className="ia-linha">
            <button type="button" className="btn btn-contorno-ouro" disabled={salvando} onClick={() => setR(base)}>Descartar</button>
            <button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
          </span>}
        </div>
      )}
    </div>
  )
}
