// Concluir a edição: o vídeo final montado, a conferência (áudio, imagem, legenda) e para onde ele vai. O destino vem da
// origem do vídeo (post planejado → o próprio post; vídeo avulso → Marketing cria a postagem; criativo de anúncio →
// Tráfego). Os outros dois aparecem apagados, como exemplo. "Concluir e entregar" sobe o vídeo e entrega.
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { BotaoConcluir } from '../../marketing/edicao/EntregaVideo'
import { destinoDa, type Destino } from '../../marketing/peca/editor'
import type { Estudio } from './useEstudio'

const DESTINOS: { id: Destino; origem: string; titulo: string; sub: string; texto: string }[] = [
  { id: 'post', origem: 'Post planejado', titulo: 'Produção do Marketing', sub: 'Post planejado', texto: 'O vídeo entra na peça, com o roteiro e o histórico do planejamento.' },
  { id: 'avulso', origem: 'Vídeo avulso', titulo: 'Marketing', sub: 'Vídeos editados para postar', texto: 'O vídeo fica pronto para o Marketing criar uma postagem avulsa e escrever a legenda.' },
  { id: 'trafego', origem: 'Criativo de anúncio', titulo: 'Tráfego', sub: 'Criativos da campanha', texto: 'O vídeo vai como criativo pronto para a campanha de anúncios. Não passa pelo Instagram.' },
]
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function ConcluirEdicao({ e, peca, aoVoltar, aoMudar }: { e: Estudio; peca: Peca; aoVoltar: () => void; aoMudar: () => void }) {
  const f = e.final!
  const destino = destinoDa(peca)
  const d = DESTINOS.find((x) => x.id === destino)!
  return (
    <div className="es-concluir">
      <section className="es-final">
        <video src={f.url} controls playsInline />
        <div>
          <h3 className="ok-txt"><Icone nome="check" tam={18} /> Vídeo final pronto</h3>
          <p className="muted">Editado e pronto para ser entregue.</p>
          <p className="pequeno"><b>{f.nome}</b><br /><span className="muted">{e.linha ? mmss(e.linha.duracao) : ''} · {peca.tipo === 'video' ? '1920 × 1080' : '1080 × 1920'} · {(f.arquivo.size / 1048576).toFixed(0)} MB</span></p>
          <a className="btn btn-contorno-ouro btn-mini" href={f.url} download={f.nome}><Icone nome="importar" tam={14} /> Baixar</a>
        </div>
        <ul className="es-checks">
          <li><Icone nome="check" tam={15} /> <b>Áudio sem distorção</b><span className="muted pequeno">Voz, música e efeitos com limitador.</span></li>
          <li><Icone nome="check" tam={15} /> <b>Imagem revisada</b><span className="muted pequeno">{e.hdr ? (e.corrigirHdr ? 'Vídeo HDR com cor corrigida.' : 'Vídeo HDR sem correção.') : 'Mesma luz e cor do bruto.'}</span></li>
          <li><Icone nome="check" tam={15} /> <b>Legendas conferidas</b><span className="muted pequeno">Sincronizadas com a fala, com destaques.</span></li>
        </ul>
      </section>
      <h2>Para onde este vídeo será entregue?</h2>
      <p className="muted">O destino vem da origem do vídeo.</p>
      <div className="es-destinos">
        {DESTINOS.map((x) => (
          <section key={x.id} className={`es-destino${x.id === destino ? ' marcado' : ''}`}>
            <header><span className="pequeno">{x.id === destino ? 'Destino deste vídeo' : 'Outras origens'}</span><span className="selo-neutro">{x.origem}</span></header>
            <h3>{x.titulo}</h3><p className="muted pequeno">{x.sub}</p>
            <p className="pequeno">{x.texto}</p>
          </section>
        ))}
      </div>
      <footer className="es-concluir-pe">
        <span><Icone nome="enviar" tam={18} /> Destino: <b>{d.titulo}</b> · {peca.titulo}</span>
        <span className="muted pequeno"><Icone nome="info" tam={13} /> Nenhuma publicação é feita nesta etapa.</span>
        <button type="button" className="btn btn-contorno" onClick={aoVoltar}>Voltar à revisão</button>
        <BotaoConcluir peca={peca} video={f.arquivo} aoMudar={aoMudar} rotulo="Concluir e entregar" />
      </footer>
    </div>
  )
}
