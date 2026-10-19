// O que entra na arte além do texto: qual logo (e onde) e as imagens que precisam aparecer como são
// (uma foto da pessoa, do produto, um selo). Diferente das referências, que só inspiram o estilo.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import { EMPRESA } from '../useMarketing'
import { NOME_USO, logosDe, useLogos } from '../../LogosMarca'
import type { Referencia, Visual } from './modelo'
import { BotaoEnviar, Miniatura, pastaDa } from './arquivos'

const POSICOES: [string, string][] = [['auto', 'Onde ficar melhor'], ['topo', 'No topo'], ['rodape', 'No rodapé'], ['canto', 'No canto inferior']]

export function EscolhaLogo({ v, muda }: { v: Visual; muda: (c: Partial<Visual>) => void }) {
  const logos = logosDe(useLogos(EMPRESA).dados?.perfil)
  const atual = v.logo ?? 'auto'
  const opcoes: [string, string][] = [['auto', 'Automático'], ...logos.map((l, i): [string, string] => [l.caminho, l.uso ? NOME_USO[l.uso] : `Logo ${i + 1}`]), ['nenhum', 'Sem logo']]
  return (
    <div className="pp-campo">
      <span className="pp-rotulo">Logo nesta peça</span>
      {logos.length ? (<>
        <div className="pp-pessoas">
          {opcoes.map(([id, nome]) => <button key={id} type="button" className={atual === id ? 'ativo' : ''} onClick={() => muda({ logo: id })}>{nome}</button>)}
        </div>
        {atual !== 'nenhum' && (
          <label className="pp-linha-curta"><span className="muted pequeno">Posição</span>
            <span className="select-icone"><select value={v.logoPosicao ?? 'auto'} onChange={(e) => muda({ logoPosicao: e.target.value })}>{POSICOES.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></span></label>
        )}
        <span className="muted pequeno">{atual === 'auto' ? 'Automático: a IA usa o logo marcado para o fundo da arte (escuro ou claro).' : atual === 'nenhum' ? 'A arte sai sem logo.' : 'A IA coloca este logo exatamente como ele é.'}</span>
      </>) : <span className="muted pequeno">Envie o logo em <Link to="/agentes/marca" className="link">Base da marca → Identidade visual</Link>. Sem logo, a arte sai sem logotipo.</span>}
    </div>
  )
}

export function ImagensParaUsar({ pecaId, lista, mudar, onde }: { pecaId: string; lista: Referencia[]; mudar: (l: Referencia[]) => void; onde: string }) {
  return (
    <div className="pp-campo">
      <span className="pp-rotulo">Imagens para usar {onde}</span>
      <div className="pp-refs">
        {lista.map((x, j) => (
          <span key={x.caminho} className="marca-imagem">
            <span className="pp-ref"><Miniatura caminho={x.caminho} nome={x.nome} />
              <button type="button" className="pp-cor-tirar" aria-label={`Tirar ${x.nome}`} onClick={() => mudar(lista.filter((_, k) => k !== j))}><Icone nome="fechar" tam={12} /></button></span>
            <input className="marca-nome" defaultValue={x.nome} aria-label="Nome da imagem" placeholder="Ex.: logo do produto"
              onBlur={(e) => e.target.value.trim() !== x.nome && mudar(lista.map((y, k) => (k === j ? { ...y, nome: e.target.value.trim() || y.nome } : y)))} />
          </span>
        ))}
        {lista.length < 4 && <BotaoEnviar pasta={pastaDa(pecaId)} texto="Enviar imagem" classe="btn btn-contorno btn-mini" aceita="image/png,image/jpeg,image/webp" aoEnviar={(caminho, nome) => mudar([...lista, { caminho, nome: nome.replace(/\.[^.]+$/, '') }])} />}
      </div>
      <span className="muted pequeno">Entram na arte como são: uma foto, um produto, um selo. Dê um nome a cada uma (ex.: "logo do produto") e diga na orientação onde ela vai. Fotos de pessoas só com autorização de uso de imagem.</span>
    </div>
  )
}

// ajuda para escrever a orientação da arte: frases prontas (com as pessoas e imagens desta peça), um exemplo e o que não pode faltar
const CENARIO = ['fundo escuro liso', 'consultório elegante', 'estúdio com luz suave', 'fundo desfocado', 'cores da marca no fundo']
const ROUPA = ['roupa: jaleco branco', 'roupa: blazer preto', 'roupa: blazer branco', 'roupa nas cores da marca']
const TEXTO = ['título grande no topo', 'pouco texto e bastante respiro', 'destaque em dourado na palavra principal', 'texto de apoio pequeno, embaixo']
// o exemplo usa quem e o que esta peça tem (cada empresa vê os próprios nomes)
const exemploDe = (pessoa?: string, imagem?: string) =>
  `${pessoa ?? 'A pessoa escolhida'} em primeiro plano, à esquerda, meio corpo, sorrindo; roupa: blazer branco; fundo escuro liso com luz suave; ${imagem ?? 'o logo do produto'} embaixo, ao centro; título grande no topo e o texto de apoio pequeno, embaixo.`

function Grupo({ nome, frases, usar }: { nome: string; frases: string[]; usar: (f: string) => void }) {
  if (!frases.length) return null
  return (
    <div className="orienta-grupo"><span className="muted pequeno">{nome}</span>
      <div className="orienta-frases">{frases.map((f) => <button key={f} type="button" onClick={() => usar(f)}><Icone nome="mais" tam={12} /> {f}</button>)}</div>
    </div>
  )
}

export function AjudaOrientacao({ valor, mudar, pessoas, imagens }: { valor: string; mudar: (v: string) => void; pessoas: string[]; imagens: string[] }) {
  const [aberta, setAberta] = useState(false)
  const exemplo = exemploDe(pessoas[0], imagens[0])
  const usar = (f: string) => mudar(valor.trim() ? `${valor.trim().replace(/[;.]$/, '')}; ${f}` : f.charAt(0).toUpperCase() + f.slice(1))
  return (
    <div className="orienta-ajuda">
      <button type="button" className="link pequeno" onClick={() => setAberta(!aberta)}><Icone nome="floco" tam={14} /> {aberta ? 'Fechar a ajuda' : 'Ajuda para escrever a orientação'}</button>
      {aberta && (<>
        <p className="muted pequeno">Uma boa orientação diz: <b>quem aparece e onde</b> · <b>roupa e expressão</b> · <b>cenário e luz</b> · <b>onde vai cada imagem</b> · <b>o que destacar no texto</b>. Clique para acrescentar e depois ajuste do seu jeito.</p>
        <Grupo nome="Quem aparece" frases={pessoas.flatMap((p) => [`${p} em primeiro plano, meio corpo, sorrindo`, `${p} ao fundo, à direita`, `${p} olhando para o título`])} usar={usar} />
        {pessoas.length > 0 && <Grupo nome="Roupa" frases={ROUPA} usar={usar} />}
        <Grupo nome="Imagens desta arte" frases={imagens.flatMap((n) => [`${n} embaixo, ao centro`, `${n} à direita, em destaque`])} usar={usar} />
        <Grupo nome="Cenário e luz" frases={CENARIO} usar={usar} />
        <Grupo nome="Texto" frases={TEXTO} usar={usar} />
        {!pessoas.length && <span className="muted pequeno">Para alguém aparecer, escolha em "Quem aparece nesta arte?" (na Direção visual). A IA mantém o rosto das fotos e muda roupa, pose e cenário como você pedir.</span>}
        <div className="orienta-exemplo"><span className="muted pequeno">Exemplo completo</span><p>{exemplo}</p>
          <button type="button" className="btn btn-mini" onClick={() => mudar(exemplo)}>Usar este exemplo</button></div>
      </>)}
    </div>
  )
}
