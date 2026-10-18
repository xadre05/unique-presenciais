// O que entra na arte além do texto: qual logo (e onde) e as imagens que precisam aparecer como são
// (uma foto da pessoa, do produto, um selo). Diferente das referências, que só inspiram o estilo.
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
          <span key={x.caminho} className="pp-ref"><Miniatura caminho={x.caminho} nome={x.nome} />
            <button type="button" className="pp-cor-tirar" aria-label={`Tirar ${x.nome}`} onClick={() => mudar(lista.filter((_, k) => k !== j))}><Icone nome="fechar" tam={12} /></button></span>
        ))}
        {lista.length < 4 && <BotaoEnviar pasta={pastaDa(pecaId)} texto="Enviar imagem" classe="btn btn-contorno btn-mini" aceita="image/png,image/jpeg,image/webp" aoEnviar={(caminho, nome) => mudar([...lista, { caminho, nome }])} />}
      </div>
      <span className="muted pequeno">Entram na arte como são: uma foto, um produto, um selo. Diga na orientação onde cada uma vai (ex.: "a foto do produto à direita"). Fotos de pessoas só com autorização de uso de imagem.</span>
    </div>
  )
}
