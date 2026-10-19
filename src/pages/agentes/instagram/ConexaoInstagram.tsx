// Base da marca → Redes sociais → Instagram ligado: cadastrar o app da Meta (ID e chave secreta), conectar a conta
// profissional e acompanhar a leitura dos posts. Depois de ligado, os resultados aparecem no Agente de Marketing.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { ENDERECO_RETORNO, acaoInstagram, milhar, salvarApp, useConexao, type Conexao } from './dados'

const AVISO: Record<string, string> = {
  ok: 'Instagram conectado. Os posts e as métricas estão sendo importados: em alguns minutos aparecem em Agente de Marketing → Resultados.',
  cancelado: 'O login no Instagram foi cancelado. Quando quiser, clique em Conectar de novo.',
  erro: 'Não deu certo conectar o Instagram. Veja o motivo abaixo e tente de novo.',
}
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

function Passos() {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => navigator.clipboard.writeText(ENDERECO_RETORNO).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) }).catch(() => undefined)
  return (
    <ol className="ig-passos">
      <li>No <b>Meta for Developers</b> (developers.facebook.com), crie um app do tipo <b>Empresa</b> e adicione o produto <b>Instagram</b>, na opção de <b>API com login do Instagram</b>.</li>
      <li>Na configuração do login comercial do Instagram, cadastre este endereço de retorno (redirecionamento OAuth):
        <span className="ig-retorno"><code>{ENDERECO_RETORNO}</code><button type="button" className="btn btn-mini" onClick={copiar}><Icone nome="copiar" tam={14} /> {copiado ? 'Copiado' : 'Copiar'}</button></span></li>
      <li>Copie o <b>ID do app do Instagram</b> e a <b>chave secreta do app do Instagram</b> e cole aqui embaixo.</li>
      <li>A conta precisa ser <b>profissional</b> (Criador de conteúdo ou Empresa). Enquanto a Meta não aprova o app, a conta entra como testadora do app.</li>
    </ol>
  )
}

function CadastroApp({ empresa, conexao, aoSalvar }: { empresa: string; conexao: Conexao | null; aoSalvar: () => void }) {
  const [appId, setAppId] = useState(conexao?.app_id ?? '')
  const [segredo, setSegredo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    setErro(null); setSalvando(true)
    try { await salvarApp(empresa, appId, segredo); setSegredo(''); aoSalvar() } catch (e) { setErro((e as Error).message) }
    setSalvando(false)
  }
  return (
    <div className="ig-cadastro">
      <div className="form-duas">
        <label>ID do app do Instagram<input value={appId} onChange={(e) => setAppId(e.target.value)} inputMode="numeric" placeholder="Só números" /></label>
        <label>Chave secreta do app {conexao?.app_id && <small className="muted">(deixe em branco para manter)</small>}<input type="password" autoComplete="off" value={segredo} onChange={(e) => setSegredo(e.target.value)} placeholder="Cole a chave secreta" /></label>
      </div>
      <span className="muted pequeno"><Icone nome="info" tam={13} /> A chave secreta fica guardada cifrada e nunca volta para a tela.</span>
      <Erro msg={erro} />
      <div className="ia-linha"><button type="button" className="btn btn-contorno-ouro" disabled={salvando || !appId.trim() || (!conexao?.app_id && !segredo.trim())} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar app'}</button></div>
    </div>
  )
}

function Conectada({ c, empresa, aoMudar }: { c: Conexao; empresa: string; aoMudar: () => void }) {
  const [fazendo, setFazendo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const agir = async (acao: 'sincronizar' | 'desligar') => {
    setErro(null); setFazendo(acao)
    try { await acaoInstagram(empresa, acao); aoMudar() } catch (e) { setErro((e as Error).message) }
    setFazendo(null); setConfirmar(false)
  }
  return (
    <div className="ig-conta">
      {c.foto ? <img src={c.foto} alt="" className="ig-foto" /> : <span className="ig-foto"><Icone nome="usuario" tam={22} /></span>}
      <div className="ig-conta-txt">
        <b>@{c.usuario}</b> <span className="mk-ponto" style={{ ['--cor-etapa' as string]: '#4cbf73' }}>Conectado</span>
        <small className="muted">{milhar(c.seguidores ?? undefined)} seguidores · {milhar(c.publicacoes ?? undefined)} publicações · lido em {data(c.sincronizado_em)} · acesso renovado sozinho (vence em {data(c.token_expira_em)})</small>
      </div>
      <div className="ia-linha">
        <button type="button" className="btn btn-contorno" disabled={!!fazendo} onClick={() => agir('sincronizar')}><Icone nome="atualizar" tam={15} /> {fazendo === 'sincronizar' ? 'Lendo os posts…' : 'Atualizar agora'}</button>
        <Link className="btn btn-contorno-ouro" to="/agentes/marketing?aba=resultados"><Icone nome="grafico" tam={15} /> Ver resultados</Link>
        {confirmar
          ? <><button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('desligar')}>Confirmar: desligar</button><button type="button" className="btn btn-mini" onClick={() => setConfirmar(false)}>Cancelar</button></>
          : <button type="button" className="btn btn-mini" onClick={() => setConfirmar(true)}>Desligar</button>}
      </div>
      <Erro msg={erro} />
    </div>
  )
}

export function ConexaoInstagram({ empresa }: { empresa: string }) {
  const conexao = useConexao(empresa)
  const [params] = useSearchParams()
  const [conectando, setConectando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const c = conexao.dados ?? null
  const aviso = AVISO[params.get('instagram') ?? '']
  const conectar = async () => {
    setErro(null); setConectando(true)
    try { const { url } = await acaoInstagram<{ url: string }>(empresa, 'link'); window.location.href = url } catch (e) { setErro((e as Error).message); setConectando(false) }
  }
  if (conexao.carregando && !c) return null
  return (
    <div className="ig">
      <h4 className="reu-lado-titulo"><Icone nome="grafico" tam={18} /> Resultados do Instagram</h4>
      <span className="muted pequeno">Com o Instagram ligado, o agente lê os posts e as métricas (alcance, salvos, compartilhamentos…), mostra o que funcionou e usa isso nas reuniões de pauta. Só leitura: nada é publicado.</span>
      {aviso && <p className={`nota pequeno${params.get('instagram') === 'ok' ? '' : ' erro-txt'}`}>{aviso}</p>}
      {c?.status === 'conectado'
        ? <Conectada c={c} empresa={empresa} aoMudar={conexao.recarregar} />
        : <>
          {!c?.app_id && <Passos />}
          <CadastroApp empresa={empresa} conexao={c} aoSalvar={conexao.recarregar} />
          {c?.app_id && <div className="ia-linha"><button type="button" className="btn btn-ouro" disabled={conectando} onClick={conectar}><Icone nome="links" tam={16} /> {conectando ? 'Abrindo o Instagram…' : 'Conectar o Instagram'}</button>
            <span className="muted pequeno">Abre o login do Instagram. Entre com a conta da marca e autorize.</span></div>}
          {c?.app_id && <details className="pequeno"><summary>Ver de novo os passos do app</summary><Passos /></details>}
        </>}
      {c?.erro && <Erro msg={c.erro} />}
      <Erro msg={erro} />
    </div>
  )
}
