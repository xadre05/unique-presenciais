// Passo 1 da edição: o vídeo bruto. Fica no computador; o navegador lembra o atalho do arquivo e, depois de recarregar,
// "Reabrir" traz o mesmo vídeo de volta num clique. "Já veio editado?" pula a edição: no Agente Editor conclui com o
// vídeo como está; na peça do Marketing abre o agendamento.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icone } from '../../../../components/Icone'
import { atalhoGuardado, escolherComAtalho, escolherVarios, reabrir, deixarArquivo } from '../../editor/arquivoPendente'
import type { ArquivoBruto } from './dados'

const segundos = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`

type Props = {
  pecaId: string; arquivo: File | null; anterior?: ArquivoBruto; confere: boolean; ocupado: boolean
  aoEscolher: (f: File) => void; jaEditado: ReactNode
  // com esta função, aceita várias partes de uma vez (vídeo gravado em pedaços)
  aoEscolherVarios?: (fs: File[]) => void
}

export function EscolhaBruto({ pecaId, arquivo, anterior, confere, ocupado, aoEscolher, jaEditado, aoEscolherVarios, partesAntes }: Props & { partesAntes?: number }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [guardado, setGuardado] = useState<string | null>(null)
  const [pularEdicao, setPularEdicao] = useState(false)
  useEffect(() => { if (!arquivo) void atalhoGuardado(pecaId).then((a) => setGuardado(a?.name ?? null)) }, [pecaId, arquivo])

  const procurar = async () => {
    if (aoEscolherVarios) {
      const v = await escolherVarios()
      if (v === null) return entrada.current?.click()
      if (v === 'cancelado' || !v.arquivos.length) return
      if (v.arquivos.length === 1) { deixarArquivo(pecaId, v.arquivos[0], v.atalhos[0]); return aoEscolher(v.arquivos[0]) }
      return aoEscolherVarios(v.arquivos)
    }
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
      {!arquivo && guardado && !partesAntes && <button type="button" className="btn btn-ouro ev-arquivo" onClick={voltar}><Icone nome="video" tam={16} /> Reabrir {guardado}</button>}
      <button type="button" className={`btn ${!arquivo && !guardado ? 'btn-ouro' : 'btn-contorno-ouro'} ev-arquivo`} onClick={procurar}><Icone nome="importar" tam={16} /> {arquivo ? 'Trocar vídeo' : guardado ? 'Escolher outro' : 'Escolher o vídeo'}</button>
      <input ref={entrada} type="file" accept="video/*" hidden multiple={!!aoEscolherVarios} onChange={(e) => {
        const fs = [...(e.target.files ?? [])]
        if (aoEscolherVarios && fs.length) aoEscolherVarios(fs)
        else if (fs[0]) { deixarArquivo(pecaId, fs[0]); aoEscolher(fs[0]) }
        e.target.value = ''
      }} />
      {aoEscolherVarios && !arquivo && <p className="pequeno muted">Gravou em partes? Escolha todas de uma vez: o agente coloca na ordem certa e junta num vídeo só.</p>}
      {arquivo && <span className="pequeno">{arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(0)} MB</span>}
      {!arquivo && anterior && !!partesAntes && <p className="pequeno">O último vídeo foi juntado de <b>{partesAntes} partes</b>. Escolha as mesmas partes para juntar de novo (sem custo) e ver a prévia.</p>}
      {!arquivo && anterior && !guardado && !partesAntes && <p className="pequeno">Último vídeo editado: <b>{anterior.nome}</b> ({segundos(anterior.duracao)}). Escolha o mesmo arquivo para ver a prévia.</p>}
      {arquivo && anterior && !confere && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> Este não é o vídeo da última edição. Editar este substitui a edição anterior.</p>}
      {arquivo && !ocupado && !pularEdicao && <button type="button" className="link pequeno" onClick={() => setPularEdicao(true)}>Este vídeo já veio editado? Pular a edição</button>}
      {arquivo && !ocupado && pularEdicao && <div className="ev-escolha">{jaEditado}
        <button type="button" className="link pequeno" onClick={() => setPularEdicao(false)}>Não, quero editar</button></div>}
    </section>
  )
}
