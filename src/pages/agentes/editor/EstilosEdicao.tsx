// Aba "Estilos" do Agente Editor: o estilo da casa (padrão de todo vídeo, editável), os estilos salvos (canais estudados
// e vídeos de referência, com a capa, um resumo e "Definir como padrão") e as regras que o editor aprendeu com os
// ajustes ("vale para os próximos vídeos"), que dá para desligar.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Icone } from '../../../components/Icone'
import { EMPRESA } from '../marketing/useMarketing'
import { atualizarPerfil, esquecer, memoriaDe } from '../memoria'
import { useReferencias, type Referencia } from '../referencias/dados'
import { estiloDe, usePerfilEditor } from './dados'
import { EstiloCasa } from './EstiloCasa'
import { BibliotecaCenas } from './BibliotecaCenas'

const LEGENDA = { palavras: 'Palavra por palavra', chave: 'Palavra-chave' }
const EFEITOS = { muitos: 'Muitos', poucos: 'Poucos', nenhum: 'Nenhum' }
const IMAGENS = { muitas: 'Muitas', algumas: 'Algumas', poucas: 'Poucas' }

function Capa({ caminho }: { caminho?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { if (caminho) void supabase.storage.from('arquivos').createSignedUrl(caminho, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)) }, [caminho])
  return <div className="est-capa">{url ? <img src={url} alt="" loading="lazy" /> : <Icone nome="video" tam={24} />}</div>
}
const capaDe = (r: Referencia) => r.tipo === 'canal' ? r.videos?.[0]?.quadros?.[Math.min(2, (r.videos[0].quadros.length || 1) - 1)] : (r.arquivos.find((a) => a.quadro) ?? r.arquivos[0])?.caminho

export function EstilosEdicao() {
  const perfil = usePerfilEditor()
  const p = perfil.dados?.perfil ?? {}
  const casa = estiloDe(p)
  const padrao = typeof p.estilo_ref === 'string' ? p.estilo_ref : ''
  const [editando, setEditando] = useState(false)
  const refs = useReferencias(EMPRESA)
  const [busca, setBusca] = useState('')
  const salvos = (refs.dados ?? []).filter((r) => r.status === 'pronta' && (r.formato === 'reels' || r.formato === 'video') && r.categoria !== 'nosso')
    .filter((r) => !busca.trim() || `${r.nome ?? ''} ${r.autor ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase()))
  const regras = memoriaDe(p).filter((m) => m.texto.startsWith('Edição:'))
  const definirPadrao = async (id: string) => { await atualizarPerfil(EMPRESA, 'editor', (x) => ({ ...x, estilo_ref: id || undefined })); perfil.recarregar() }
  const desligar = async (texto: string) => { await esquecer(EMPRESA, 'editor', texto); perfil.recarregar() }
  const nomePadrao = (refs.dados ?? []).find((r) => r.id === padrao)?.nome

  return (
    <div className="est">
      <div className="est-topo">
        <div><h2>Estilos de edição</h2><p className="muted">O jeito da marca, com espaço para variar em cada vídeo.</p></div>
        <div className="est-novo">
          <Link to="/agentes/marca?aba=conhecimento&ref=canal" className="btn btn-ouro"><Icone nome="mais" tam={15} /> Novo estilo</Link>
          <span className="muted pequeno"><Link to="/agentes/marca?aba=conhecimento&ref=canal" className="link">Estudar um canal</Link> · <Link to="/agentes/marca?aba=conhecimento&ref=nova" className="link">Usar um vídeo de referência</Link></span>
        </div>
      </div>

      <section className="est-casa">
        <div>
          <span className="selo-ouro">Padrão</span>
          <h3>Estilo da casa{nomePadrao ? ` · no estilo "${nomePadrao}"` : ''}</h3>
          <p className="muted">Vale para todo vídeo. Num vídeo específico, escolha outro no Estúdio.</p>
          <div className="est-chips">
            <span><Icone nome="texto" tam={15} /> Legendas<b>{LEGENDA[casa.legenda]}</b></span>
            <span><Icone nome="raio" tam={15} /> Efeitos<b>{EFEITOS[casa.efeitos]}</b></span>
            <span><Icone nome="imagem" tam={15} /> Imagens de apoio<b>{IMAGENS[casa.imagens]}</b></span>
            <span><Icone nome="busca" tam={15} /> Zoom<b>{casa.zoom ? 'Nas frases fortes' : 'Sem zoom'}</b></span>
          </div>
          {padrao && <button type="button" className="link pequeno" onClick={() => void definirPadrao('')}>Voltar a usar só o estilo da casa</button>}
        </div>
        <button type="button" className="btn btn-ouro" onClick={() => setEditando(!editando)}>{editando ? 'Fechar' : 'Editar estilo'}</button>
        {editando && <div className="est-form"><EstiloCasa perfil={p} aoSalvar={perfil.recarregar} /></div>}
      </section>

      <section>
        <div className="est-sec-topo"><h3>Estilos salvos</h3>
          <input type="search" className="est-busca" placeholder="Buscar estilos…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        {!salvos.length ? <p className="muted pequeno">Nenhum estilo salvo{busca ? ' com esse nome' : ''}. Estude um canal ou guarde um vídeo de referência.</p> : (
          <div className="est-grade">{salvos.map((r) => (
            <article key={r.id} className={`est-cartao${r.id === padrao ? ' padrao' : ''}`}>
              <Capa caminho={capaDe(r)} />
              <h4>{r.nome || 'Referência'}</h4>
              <p className="muted pequeno">{r.ficha?.resumo ? String(r.ficha.resumo).slice(0, 110) : r.autor ?? ''}</p>
              <span className="pequeno muted"><Icone nome={r.tipo === 'canal' ? 'grafico' : 'video'} tam={13} /> {r.tipo === 'canal' ? 'Canal estudado' : 'Vídeo de referência'}</span>
              <div className="est-acoes">
                <Link className="btn btn-contorno-ouro btn-mini" to="/agentes/marca?aba=conhecimento">Ver ficha</Link>
                {r.id === padrao ? <span className="selo-ouro">Padrão</span> : <button type="button" className="btn btn-ouro btn-mini" onClick={() => void definirPadrao(r.id)}>Definir como padrão</button>}
              </div>
            </article>
          ))}</div>
        )}
      </section>

      <section className="est-regras">
        <div className="est-sec-topo"><h3>Regras aprendidas</h3><span className="muted pequeno"><Icone nome="info" tam={13} /> Vêm dos ajustes marcados "vale para os próximos vídeos".</span></div>
        {!regras.length ? <p className="muted pequeno">Nenhuma regra ainda.</p> : (
          <table className="tabela">
            <thead><tr><th>Regra</th><th>Status</th><th>Desde</th><th /></tr></thead>
            <tbody>{regras.map((m) => (
              <tr key={m.texto}><td>{m.texto.replace(/^Edição:\s*/, '')}</td><td><span className="ok-txt">● Ativa</span></td><td>{new Date(m.em).toLocaleDateString('pt-BR')}</td>
                <td><button type="button" className="link pequeno" onClick={() => void desligar(m.texto)}>Desativar</button></td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <BibliotecaCenas />
    </div>
  )
}
