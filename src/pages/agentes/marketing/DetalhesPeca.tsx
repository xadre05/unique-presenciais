// Coluna da direita da peça: detalhes (canal, formato, situação, data, horário, campanha, planejamento),
// capa ou arte, etapas da produção e arquivos. Peça avulsa ou do plano: o editor é o mesmo.
import { useState } from 'react'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { ETAPAS, ehIdeia, etapaDe, moverPara, mudarPeca, type Etapa } from './etapas'
import { instrucaoNovoFormato, pedirAjuste } from './ajuste'
import { REDES, nomeFormato, redeDe, useRedes, type Rede } from './redes'
import type { Campanha } from './useMarketing'
import type { Plano } from './planos'

type Props = { peca: Peca; campanhas: Campanha[]; planos: Plano[]; aoMudar: () => void; ocupada: boolean }

export function DetalhesPeca({ peca, campanhas, planos, aoMudar, ocupada }: Props) {
  const ativas = useRedes()
  const [erro, setErro] = useState<string | null>(null)
  const [adaptar, setAdaptar] = useState<{ rede: Rede; tipo: string } | null>(null)
  const rede = redeDe(peca)
  const etapa = etapaDe(peca)
  const escrita = !ehIdeia(peca) && !!(peca.conteudo.roteiro?.length || peca.conteudo.legenda)
  const gravar = async (campos: Record<string, unknown>) => { setErro(null); const { error } = await mudarPeca(peca.id, campos); if (error) return setErro(msgErro(error)); aoMudar() }
  // mudou canal ou formato de uma peça já escrita: o texto precisa ser adaptado (o agente faz, se você pedir)
  const trocar = async (r: Rede, tipo: string) => {
    await gravar({ tipo, conteudo: { ...peca.conteudo, rede: r, livre: undefined } })
    if (escrita) setAdaptar({ rede: r, tipo })
  }
  const pedirAdaptacao = async () => {
    if (!adaptar) return
    const m = await pedirAjuste(peca, `${instrucaoNovoFormato(nomeFormato(adaptar.tipo, adaptar.rede))} O canal agora é ${REDES[adaptar.rede].nome}: siga o jeito desse canal.`, { lembrar: false, tipo_novo: adaptar.tipo })
    setAdaptar(null); if (m) setErro(m); aoMudar()
  }
  const situacao = async (e: Etapa) => { const { error } = await moverPara(peca, e); if (error) return setErro(msgErro(error)); aoMudar() }
  const visual = peca.tipo === 'post' || peca.tipo === 'carrossel'
  const tamanho = peca.tipo === 'video' ? '16:9' : peca.tipo === 'reels' || peca.tipo === 'stories' ? '9:16' : '4:5'

  return (
    <aside className="mk-lado">
      <section className="mk-cartao-lado">
        <h3><Icone nome="documento" tam={18} /> Detalhes da peça</h3>
        <dl className="mk-detalhes">
          <dt>Canal</dt><dd><select value={peca.conteudo.livre ? '' : rede} disabled={ocupada} onChange={(e) => { const r = e.target.value as Rede; trocar(r, REDES[r].formatos.includes(peca.tipo as never) ? peca.tipo : REDES[r].formatos[0]) }}>
            {peca.conteudo.livre && <option value="">O agente escolhe</option>}{[...new Set([...ativas, rede])].map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}</select></dd>
          <dt>Formato</dt><dd><select value={peca.tipo} disabled={ocupada || !!peca.conteudo.livre} onChange={(e) => trocar(rede, e.target.value)}>{REDES[rede].formatos.map((f) => <option key={f} value={f}>{nomeFormato(f, rede)}</option>)}</select></dd>
          <dt>Situação</dt><dd><select value={etapa === 'descartada' ? '' : etapa} disabled={ocupada} onChange={(e) => situacao(e.target.value as Etapa)}>{ETAPAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></dd>
          <dt>Data planejada <small>(opcional)</small></dt><dd><input type="date" value={peca.dia ?? ''} onChange={(e) => gravar({ dia: e.target.value || null })} /></dd>
          <dt>Horário</dt><dd><input type="time" value={peca.conteudo.horario ?? ''} onChange={(e) => gravar({ conteudo: { ...peca.conteudo, horario: e.target.value } })} /></dd>
          <dt>Campanha <small>(opcional)</small></dt><dd><select value={peca.conteudo.campanha ?? ''} onChange={(e) => gravar({ conteudo: { ...peca.conteudo, campanha: e.target.value || undefined } })}><option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></dd>
          <dt>Planejamento <small>(opcional)</small></dt><dd><select value={String(peca.conteudo.plano ?? '')} onChange={(e) => gravar({ conteudo: { ...peca.conteudo, plano: e.target.value || undefined } })}><option value="">Avulsa</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></dd>
        </dl>
        <p className="pequeno muted"><Icone nome="info" tam={14} /> Esta peça pode ser produzida com ou sem planejamento.</p>
        {adaptar && <div className="mk-aviso mk-aviso-info"><span>Agora é {REDES[adaptar.rede].nome} · {nomeFormato(adaptar.tipo, adaptar.rede)}. O texto ainda é do formato anterior.</span><button className="btn btn-ouro btn-mini" onClick={pedirAdaptacao}>Pedir ao agente para adaptar</button><button className="btn btn-mini" onClick={() => setAdaptar(null)}>Eu ajusto</button></div>}
        <Erro msg={erro} />
      </section>

      <section className="mk-cartao-lado">
        <h3><Icone nome="imagem" tam={18} /> {peca.tipo === 'video' ? 'Capa do vídeo' : visual ? 'Prévia da arte' : 'Vídeo'} <span className="mk-etq">{visual || peca.tipo === 'video' ? 'Não gerada' : 'A gravar'}</span></h3>
        <div className={`mk-arte-quadro${tamanho === '9:16' ? ' vertical' : tamanho === '16:9' ? ' deitado' : ''}`}><Icone nome={visual || peca.tipo === 'video' ? 'imagem' : 'video'} tam={36} /><span>{visual || peca.tipo === 'video' ? 'Prévia ainda não gerada' : 'A equipe grava seguindo o roteiro'}</span><small>{tamanho}</small></div>
        {(visual || peca.tipo === 'video') && <button className="btn btn-contorno-ouro" disabled title="Falta ligar a IA de imagem em Configurações"><Icone nome="imagem" /> {peca.tipo === 'video' ? 'Gerar proposta de capa' : 'Gerar prévia'}</button>}
        <p className="pequeno muted">A geração de imagem entra quando a chave da IA de imagem estiver em Configurações. Até lá, use o pedido da imagem (em Direção visual).</p>
      </section>

      <section className="mk-cartao-lado">
        <h3><Icone nome="lista" tam={18} /> Etapas da produção</h3>
        <ol className="mk-etapas">
          <li><b>{peca.tipo === 'video' || peca.tipo === 'reels' ? 'Roteiro' : 'Texto'}</b><span className="muted pequeno">Estrutura e mensagens</span><i>{ehIdeia(peca) ? 'Ideia' : etapa === 'pronto' || etapa === 'publicado' ? 'Aprovado' : 'Em revisão'}</i></li>
          <li><b>{visual ? 'Arte' : peca.tipo === 'video' ? 'Capa e gravação' : 'Gravação'}</b><span className="muted pequeno">{visual ? 'Imagem da peça' : 'Feita pela equipe'}</span><i>{etapa === 'publicado' ? 'Feita' : 'Pendente'}</i></li>
          <li><b>Revisão final</b><span className="muted pequeno">Aprovar e postar</span><i>{etapa === 'publicado' ? 'Postada' : etapa === 'pronto' ? 'Aprovada' : 'Pendente'}</i></li>
        </ol>
      </section>
    </aside>
  )
}
