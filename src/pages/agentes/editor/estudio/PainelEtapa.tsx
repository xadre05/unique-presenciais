// Área principal do Estúdio quando uma etapa está aberta (Alterar): o conteúdo da etapa e, embaixo, Voltar e Continuar.
// Na última etapa, "Editar com o agente" (primeira edição ou vídeo novo) ou "Ver a prévia".
import { useRef, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { ApoioEdicao } from '../../marketing/edicao/ApoioEdicao'
import { EscolhaBruto } from '../../marketing/edicao/EscolhaBruto'
import { BotaoConcluir } from '../../marketing/edicao/EntregaVideo'
import { ConviteEditor } from '../../marketing/edicao/ConviteEditor'
import { alterarPeca } from '../../marketing/peca/useEdicao'
import { EscolhaEstilo } from './EscolhaEstilo'
import { GerarBroll } from '../ia/GerarBroll'
import { PASSOS, type Estudio, type Passo } from './useEstudio'
import { PartesDoVideo } from '../partes/PartesDoVideo'
import { ACEITOS, lerTexto } from '../../biblioteca/lerArquivo'

const PROXIMO: Record<Passo, string> = { video: 'Continuar: conteúdo', conteudo: 'Continuar: estilo', estilo: 'Continuar: imagens e música', imagens: '' }

function Conteudo({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const [roteiro, setRoteiro] = useState((peca.conteudo.roteiro ?? []).join('\n\n'))
  const [salvo, setSalvo] = useState(true)
  const [lendo, setLendo] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const guardar = async (texto = roteiro) => {
    const cenas = texto.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
    await alterarPeca(peca.id, (p) => ({ conteudo: { ...p.conteudo, roteiro: cenas.length ? cenas : undefined } }))
    setSalvo(true); aoMudar()
  }
  // roteiro em PDF ou Word: lê o texto do arquivo e guarda como o roteiro deste vídeo
  const subir = async (f: File) => {
    setLendo(`Lendo ${f.name}…`)
    try {
      const texto = (await lerTexto(f)).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
      if (!texto) throw new Error('Não encontrei texto neste arquivo (é uma imagem escaneada?).')
      setRoteiro(texto); await guardar(texto); setLendo(null)
    } catch (e) { setLendo(e instanceof Error ? e.message : 'Não consegui ler o arquivo.') }
  }
  return (
    <div className="es-conteudo">
      <h2>O que este vídeo fala</h2>
      <p className="muted">O roteiro é opcional. Sem ele, o agente procura nos materiais da campanha (ex.: o PDF dos criativos) qual foi gravado; sem nenhum, edita pelo que foi falado.</p>
      <div className="es-roteiro-arquivo">
        <button type="button" className="btn btn-contorno-ouro" onClick={() => entrada.current?.click()}><Icone nome="importar" tam={15} /> Subir o roteiro (PDF ou Word)</button>
        {lendo && <span className="pequeno muted">{lendo}</span>}
        <input ref={entrada} type="file" accept={ACEITOS} hidden onChange={(x) => { const f = x.target.files?.[0]; if (f) void subir(f); x.target.value = '' }} />
      </div>
      <label className="campo"><span>Roteiro gravado <small className="muted">(cenas separadas por uma linha em branco)</small></span>
        <textarea rows={10} value={roteiro} onChange={(x) => { setRoteiro(x.target.value); setSalvo(false) }} onBlur={() => { if (!salvo) void guardar() }} /></label>
    </div>
  )
}

export function PainelEtapa({ e, peca, aoMudar }: { e: Estudio; peca: Peca; aoMudar: () => void }) {
  const p = e.passo!
  const i = PASSOS.indexOf(p)
  const [convite, setConvite] = useState(false)
  const primeira = !e.receita || !e.confere
  const editar = () => (e.temEditor === false ? setConvite(true) : void e.editar())
  return (
    <section className="es-painel-etapa">
      {p === 'video' && e.partes && <PartesDoVideo peca={peca} arquivos={e.partes} edicao={e.edicao} aoJuntar={e.juntou} aoCancelar={e.cancelarPartes} />}
      {p === 'video' && !e.partes && <EscolhaBruto pecaId={peca.id} arquivo={e.arquivo} anterior={e.edicao.arquivo} confere={e.confere} ocupado={!!e.ocupado} aoEscolher={e.escolher}
        aoEscolherVarios={e.escolherVarios} partesAntes={e.edicao.partes?.length}
        jaEditado={<BotaoConcluir peca={peca} video={e.arquivo} aoMudar={aoMudar} rotulo="Concluir com este vídeo como está" />} />}
      {p === 'conteudo' && <Conteudo peca={peca} aoMudar={aoMudar} />}
      {p === 'estilo' && <EscolhaEstilo e={e} pecaId={peca.id} aoMudar={aoMudar} />}
      {p === 'imagens' && <ApoioEdicao midias={e.apoio.midias} novasDoBanco={e.apoio.novasDoBanco.length} arquivos={e.apoio.arquivos} musica={e.edicao.musica ? { ...e.edicao.musica, volume: e.apoio.volume } : undefined} arquivoMusica={e.apoio.arquivoMusica}
        aoAdicionar={e.apoio.adicionar} aoRemover={e.apoio.remover} aoDescrever={e.apoio.descrever} aoMusica={e.apoio.escolherMusica} aoVolume={e.apoio.mudarVolume} />}
      {p === 'imagens' && <GerarBroll pecaId={peca.id} palavras={e.edicao.palavras} aoMudar={aoMudar} />}
      {convite && <ConviteEditor />}
      <footer className="es-painel-pe">
        <button type="button" className="btn btn-contorno" onClick={() => e.setPasso(i > 0 ? PASSOS[i - 1] : e.receita ? null : 'video')} disabled={i === 0 && !e.receita}><Icone nome="esquerda" tam={15} /> Voltar</button>
        {i < PASSOS.length - 1 ? <button type="button" className="btn btn-ouro" onClick={() => e.setPasso(PASSOS[i + 1])} disabled={p === 'video' && (!e.arquivo || !!e.partes)}>{PROXIMO[p]} <Icone nome="seta_dir" tam={15} /></button>
          : primeira ? <button type="button" className="btn btn-ouro" onClick={editar} disabled={!e.arquivo || !!e.ocupado}><Icone nome="floco" tam={15} /> Editar com o agente</button>
            : <button type="button" className="btn btn-ouro" onClick={() => e.setPasso(null)}>Ver a prévia <Icone nome="seta_dir" tam={15} /></button>}
      </footer>
    </section>
  )
}
