// Avisos instantâneos (webhook): com eles o Instagram avisa na hora que alguém comentou, e a mensagem sai em segundos
// em vez de até 2 minutos. Mostra o endereço e o código para colar no painel da Meta, o passo a passo e quando chegou
// o último aviso. Só passa a funcionar para todo mundo depois que a Meta aprovar o app.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { BotaoCopiar } from '../marketing/peca/CampoEditor'
import { assinarAvisos, prepararAviso } from './dados'

type Dados = { endereco: string; codigo: string; ultimo_aviso: string | null }

export function AvisosInstantaneos({ empresa }: { empresa: string }) {
  const [aberto, setAberto] = useState(false)
  const [dados, setDados] = useState<Dados | null>(null)
  const [fazendo, setFazendo] = useState<'preparar' | 'assinar' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const abrir = async () => {
    setAberto(!aberto); if (dados || aberto) return
    setFazendo('preparar'); setErro(null)
    try { setDados(await prepararAviso(empresa)) } catch (e) { setErro((e as Error).message) }
    setFazendo(null)
  }
  const assinar = async () => {
    setFazendo('assinar'); setErro(null); setAviso(null)
    try { await assinarAvisos(empresa); setAviso('Pronto: o Instagram vai avisar os comentários desta conta.') } catch (e) { setErro((e as Error).message) }
    setFazendo(null)
  }

  return (
    <section className="mk-painel au-avisos">
      <button type="button" className="au-avisos-topo" onClick={abrir} aria-expanded={aberto}>
        <span><b><Icone nome="raio" tam={16} /> Avisos instantâneos</b><small className="muted">Opcional. Faz a mensagem sair em segundos. Depende da aprovação do app pela Meta.</small></span>
        <Icone nome={aberto ? 'cima' : 'baixo'} tam={16} />
      </button>
      {aberto && (
        <div className="au-avisos-corpo">
          {fazendo === 'preparar' && <p className="muted pequeno">Preparando…</p>}
          {dados && <>
            <ol className="au-passos">
              <li>No painel do app na Meta (developers.facebook.com), abra <b>Instagram → Configuração da API com login do Instagram → Configurar webhooks</b>.</li>
              <li>Cole o endereço e o código abaixo e clique em <b>Verificar e salvar</b>.
                <div className="au-copiar"><code>{dados.endereco}</code><BotaoCopiar texto={dados.endereco} rotulo="Copiar endereço" /></div>
                <div className="au-copiar"><code>{dados.codigo}</code><BotaoCopiar texto={dados.codigo} rotulo="Copiar código" /></div></li>
              <li>Na lista de campos, ative <b>comments</b> (e <b>messages</b>, para o futuro).</li>
              <li>Volte aqui e clique em <b>Pedir avisos desta conta</b>.</li>
              <li>Para valer para qualquer seguidor: app publicado (modo Live), verificação do negócio e acesso avançado aprovado para comentários.</li>
            </ol>
            <div className="au-avisos-rodape">
              <button type="button" className="btn btn-contorno-ouro" disabled={!!fazendo} onClick={assinar}><Icone nome="raio" tam={15} /> {fazendo === 'assinar' ? 'Pedindo…' : 'Pedir avisos desta conta'}</button>
              <span className="muted pequeno">{dados.ultimo_aviso ? `Último aviso recebido: ${new Date(dados.ultimo_aviso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Nenhum aviso recebido ainda.'}</span>
            </div>
          </>}
          {aviso && <p className="nota pequeno">{aviso}</p>}
          <Erro msg={erro} />
        </div>
      )}
    </section>
  )
}
