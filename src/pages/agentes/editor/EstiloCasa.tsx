// "Estilo da casa" do Editor de Vídeo: como a empresa quer TODOS os vídeos editados (legenda, efeitos, quantidade de
// imagem, tela dividida, zoom e observações). O agente segue sem ninguém precisar pedir em cada vídeo.
import { useEffect, useState } from 'react'
import { Erro } from '../../../components/ui'
import { estiloDe, guardarEstilo, type Estilo } from './dados'

type Opcao<T extends string> = { valor: T; texto: string }
function Escolha<T extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T; opcoes: Opcao<T>[]; aoMudar: (v: T) => void }) {
  return (
    <label className="campo"><span>{rotulo}</span>
      <span className="select-icone"><select value={valor} onChange={(e) => aoMudar(e.target.value as T)}>{opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</select></span>
    </label>
  )
}

export function EstiloCasa({ perfil, aoSalvar }: { perfil?: Record<string, unknown>; aoSalvar: () => void }) {
  const [e, setE] = useState<Estilo>(estiloDe(perfil))
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { setE(estiloDe(perfil)) }, [perfil])
  const mudar = (campos: Partial<Estilo>) => { setE((x) => ({ ...x, ...campos })); setSalvo(false) }
  const salvar = async () => { const r = await guardarEstilo(e); setErro(r); if (!r) { setSalvo(true); aoSalvar() } }
  return (
    <div className="estilo-casa">
      <p className="muted pequeno">Vale para todos os vídeos. Num vídeo específico, é só pedir diferente no ajuste.</p>
      <div className="estilo-grade">
        <Escolha rotulo="Legenda" valor={e.legenda} aoMudar={(v) => mudar({ legenda: v })} opcoes={[{ valor: 'palavras', texto: 'Falada, palavra por palavra' }, { valor: 'chave', texto: 'Só palavras-chave em caixa' }]} />
        <Escolha rotulo="Efeitos sonoros" valor={e.efeitos} aoMudar={(v) => mudar({ efeitos: v })} opcoes={[{ valor: 'muitos', texto: 'Muitos (woosh, hit, riser, clique)' }, { valor: 'poucos', texto: 'Poucos, só nos momentos fortes' }, { valor: 'nenhum', texto: 'Nenhum' }]} />
        <Escolha rotulo="Imagens por cima da fala" valor={e.imagens} aoMudar={(v) => mudar({ imagens: v })} opcoes={[{ valor: 'muitas', texto: 'Muitas (metade do vídeo)' }, { valor: 'algumas', texto: 'Algumas' }, { valor: 'poucas', texto: 'Poucas' }]} />
        <label className="campo-check"><input type="checkbox" checked={e.tela_dividida} onChange={(x) => mudar({ tela_dividida: x.target.checked })} /> Usar tela dividida (imagem em cima, pessoa embaixo)</label>
        <label className="campo-check"><input type="checkbox" checked={e.zoom} onChange={(x) => mudar({ zoom: x.target.checked })} /> Zoom nas frases fortes</label>
      </div>
      <label className="campo"><span>Outras orientações</span>
        <textarea rows={2} value={e.observacoes ?? ''} onChange={(x) => mudar({ observacoes: x.target.value })} placeholder='Ex.: "gancho sempre com texto grande no topo", "palavras de destaque em dourado", "fechar com a chamada para o link da bio"' /></label>
      <div className="linha-acoes"><button type="button" className="btn btn-ouro btn-mini" onClick={salvar}>Salvar estilo</button>{salvo && <span className="ok-txt pequeno">Salvo</span>}</div>
      <Erro msg={erro} />
    </div>
  )
}
