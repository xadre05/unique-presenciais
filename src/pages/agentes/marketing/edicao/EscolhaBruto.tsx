// Passo 1 da edição: o vídeo bruto. Fica no computador; o navegador lembra o atalho do arquivo e, depois de recarregar,
// "Reabrir" traz o mesmo vídeo de volta num clique. "Já veio editado?" pula a edição: no Agente Editor conclui com o
// vídeo como está; na peça do Marketing abre o agendamento.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icone } from '../../../../components/Icone'
import { atalhoGuardado, escolherComAtalho, reabrir, deixarArquivo } from '../../editor/arquivoPendente'
import type { ArquivoBruto } from './dados'

const segundos = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`

type Props = {
  pecaId: string; arquivo: File | null; anterior?: ArquivoBruto; confere: boolean; ocupado: boolean
  aoEscolher: (f: File) => void; jaEditado: ReactNode
}

export function EscolhaBruto({ pecaId, arquivo, anterior, confere, ocupado, aoEscolher, jaEditado }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [guardado, setGuardado] = useState<string | null>(null)
  const [pularEdicao, setPularEdicao] = useState(false)
  useEffect(() => { if (!arquivo) void atalhoGuardado(pecaId).then((a) => setGuardado(a?.name ?? null)) }, [pecaId, arquivo])

  const procurar = async () => {
    const r = await escolherComAtalho()
    if (r === null) return entrada.current?.click()
    if (r === 'cancelado') return
    deixarArquivo(pecaId, r.arquivo, r.atalho); aoEscolher(r.arquivo)
  }
  const voltar = async () => { const f = await reabrir(pecaId); if (f) aoEscolher(f); else void procurar() }

  return (
    <section className="ev-passo">
      <h4><span>1</span> Vídeo gravado</h4>
      <p className="muted pequeno">O vídeo fica no seu computador (não sobe para o sistema) e continua escolhido ao trocar de aba ou de tela.</p>
      {!arquivo && guardado && <button type="button" className="btn btn-ouro ev-arquivo" onClick={voltar}><Icone nome="video" tam={16} /> Reabrir {guardado}</button>}
      <button type="button" className={`btn ${!arquivo && !guardado ? 'btn-ouro' : 'btn-contorno-ouro'} ev-arquivo`} onClick={procurar}><Icone nome="importar" tam={16} /> {arquivo ? 'Trocar vídeo' : guardado ? 'Escolher outro' : 'Escolher o vídeo'}</button>
      <input ref={entrada} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { deixarArquivo(pecaId, f); aoEscolher(f) } e.target.value = '' }} />
      {arquivo && <span className="pequeno">{arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(0)} MB</span>}
      {!arquivo && anterior && !guardado && <p className="pequeno">Último vídeo editado: <b>{anterior.nome}</b> ({segundos(anterior.duracao)}). Escolha o mesmo arquivo para ver a prévia.</p>}
      {arquivo && anterior && !confere && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> Este não é o vídeo da última edição. Editar este substitui a edição anterior.</p>}
      {arquivo && !ocupado && !pularEdicao && <button type="button" className="link pequeno" onClick={() => setPularEdicao(true)}>Este vídeo já veio editado? Pular a edição</button>}
      {arquivo && !ocupado && pularEdicao && <div className="ev-escolha">{jaEditado}
        <button type="button" className="link pequeno" onClick={() => setPularEdicao(false)}>Não, quero editar</button></div>}
    </section>
  )
}
