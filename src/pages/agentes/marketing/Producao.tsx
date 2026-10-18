// Produção de conteúdo: à esquerda as peças da semana, no meio o editor, à direita a prévia da arte e as etapas.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { Vazio } from '../../../components/ui'
import { TIPO_PECA, dataLonga, type Peca, type Trabalho } from '../comum'
import { COR_TIPO, ETAPA, ETAPAS, etapaDe, ehIdeia } from './etapas'
import { ajustesDa } from './ajuste'
import { EditorPeca } from './EditorPeca'

function ListaPecas({ pecas, aberta, aoAbrir }: { pecas: Peca[]; aberta: string | null; aoAbrir: (p: Peca) => void }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const termo = busca.trim().toLowerCase()
  const lista = pecas.filter((p) => (!filtro || etapaDe(p) === filtro) && (!termo || p.titulo.toLowerCase().includes(termo)))
  return (
    <aside className="mk-lista">
      <h3>Peças da semana</h3>
      <label className="select-icone"><Icone nome="busca" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça…" /></label>
      <label className="select-icone"><Icone nome="filtro" /><select value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="">Todas as etapas</option>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
      <div className="mk-lista-itens">{lista.map((p) => {
        const e = etapaDe(p)
        return (
          <button key={p.id} className={`mk-lista-item${aberta === p.id ? ' aberta' : ''}`} style={{ ['--cor-tipo' as string]: COR_TIPO[p.tipo] ?? '#888' }} onClick={() => aoAbrir(p)}>
            <span className="mk-cartao-tipo">{TIPO_PECA[p.tipo]}</span>
            <b>{p.titulo}</b>
            <span className="mk-cartao-linha">{p.dia ? dataLonga(p.dia) : 'sem dia'}</span>
            {e !== 'descartada' && <span className="mk-ponto" style={{ ['--cor-etapa' as string]: ETAPA[e].cor }}>{ETAPA[e].nome}</span>}
          </button>
        )
      })}{!lista.length && <span className="muted pequeno">Nenhuma peça.</span>}</div>
    </aside>
  )
}

function LadoArte({ peca }: { peca: Peca }) {
  const visual = peca.tipo === 'post' || peca.tipo === 'carrossel'
  const etapa = etapaDe(peca)
  const passos = [
    { nome: 'Roteiro', sub: 'Estrutura e mensagens', st: ehIdeia(peca) ? 'Ideia' : etapa === 'revisao' || etapa === 'producao' ? 'Em revisão' : 'Aprovado' },
    { nome: visual ? 'Arte' : 'Gravação', sub: visual ? 'Imagem da peça' : 'Você grava seguindo o roteiro', st: visual ? 'Não gerada' : etapa === 'publicado' ? 'Feita' : 'A gravar' },
    { nome: 'Revisão final', sub: 'Aprovar e postar', st: etapa === 'publicado' ? 'Postada' : etapa === 'pronto' ? 'Aprovada' : 'Pendente' },
  ]
  return (
    <aside className="mk-arte">
      <h3>Prévia da arte <span className="mk-etq">Não gerada</span></h3>
      <div className={`mk-arte-quadro${peca.tipo === 'stories' || peca.tipo === 'reels' ? ' vertical' : ''}`}>
        <Icone nome={visual ? 'imagem' : 'video'} tam={40} />
        <span>{visual ? 'Sua arte aparecerá aqui' : 'Reels e stories você grava'}</span>
        <small>{peca.tipo === 'post' || peca.tipo === 'carrossel' ? '1080 × 1350 · Instagram' : '1080 × 1920 · vertical'}</small>
      </div>
      {visual && <button className="btn btn-contorno-ouro" disabled title="Falta ligar a IA de imagem em Configurações"><Icone nome="imagem" /> Gerar prévia</button>}
      <p className="pequeno muted">{visual ? 'A geração de imagem entra quando a chave da IA de imagem estiver em Configurações. Até lá, use o pedido da imagem (aba Direção visual).' : 'Em breve: subir o vídeo gravado para o sistema legendar e cortar.'}</p>
      <h3>Etapas de produção</h3>
      <ol className="mk-etapas">{passos.map((p) => <li key={p.nome}><b>{p.nome}</b><span className="muted pequeno">{p.sub}</span><i>{p.st}</i></li>)}</ol>
    </aside>
  )
}

export function Producao({ pecas, aberta, aoAbrir, trabalhos, aoMudar }: { pecas: Peca[]; aberta: Peca | null; aoAbrir: (p: Peca) => void; trabalhos: Trabalho[]; aoMudar: () => void }) {
  const { rodando, ultimo } = ajustesDa(aberta, trabalhos)
  return (
    <section className="mk-producao">
      <ListaPecas pecas={pecas} aberta={aberta?.id ?? null} aoAbrir={aoAbrir} />
      {aberta
        ? <><EditorPeca key={aberta.id} peca={aberta} rodando={rodando} ultimo={ultimo} aoMudar={aoMudar} /><LadoArte peca={aberta} /></>
        : <div className="mk-editor"><Vazio>Escolha uma peça à esquerda para editar, pedir ajuste ao agente e aprovar.</Vazio></div>}
    </section>
  )
}
