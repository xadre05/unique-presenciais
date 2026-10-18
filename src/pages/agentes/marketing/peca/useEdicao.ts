// Edição da peça: o rascunho na tela, o salvamento automático e as aprovações.
// - Salva sozinho 1,5 s depois da última mudança (e na hora em "Salvar rascunho").
// - Cada sessão de edição vira UMA versão da equipe (as mudanças seguidas atualizam a mesma versão).
// - Sempre lê a peça do banco antes de gravar, para não desfazer o que mudou em outro lugar (detalhes, agente).
// - Mudar o texto depois de aprovado devolve o texto para revisão.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { msgErro } from '../../../../lib/dados'
import { useAuth } from '../../../../auth'
import type { Peca } from '../../comum'
import { camposDaFoto, camposDo, fotoDe, iguais, rascunhoDaPeca, versoesDe, type Foto, type Rascunho, type Versao } from './modelo'
import { notaDe } from './diferencas'

type Linha = { titulo: string; tipo: string; status: string; conteudo: Record<string, unknown> }
export type Estado = 'salvo' | 'alterado' | 'salvando' | 'erro'
const TEXTO: (keyof Foto)[] = ['titulo', 'legenda', 'roteiro', 'cta', 'hashtags', 'texto_arte', 'objetivo']
const textoMudou = (a: Foto | undefined, b: Foto) => !a || TEXTO.some((k) => !iguais(a[k] ?? null, b[k] ?? null))

// lê a peça como está no banco, aplica a mudança e grava
export async function alterarPeca(id: string, mudar: (p: Linha) => Partial<Linha>, quando = new Date().toISOString()) {
  const { data, error } = await supabase.from('agentes_pecas').select('titulo,tipo,status,conteudo').eq('id', id).single()
  if (error || !data) return msgErro(error ?? { message: 'Peça não encontrada.' })
  const { error: e } = await supabase.from('agentes_pecas').update({ ...mudar(data as Linha), atualizado_em: quando }).eq('id', id)
  return e ? msgErro(e) : null
}

export function useEdicao(peca: Peca, aoMudar: () => void) {
  const { perfil } = useAuth()
  const nome = perfil?.nome?.split(' ')[0] || 'Equipe'
  const [r, setR] = useState<Rascunho>(() => rascunhoDaPeca(peca))
  const [estado, setEstado] = useState<Estado>('salvo')
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const rRef = useRef(r)
  const rev = useRef(0)
  const meus = useRef(new Set<string>())
  const minhaVersao = useRef<number | null>(null)
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  rRef.current = r

  useEffect(() => { setR(rascunhoDaPeca(peca)); setEstado('salvo'); setSalvoEm(null); minhaVersao.current = null }, [peca.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // mudança de fora (agente, detalhes, restaurar): recarrega, a não ser que haja edição esperando para salvar
  useEffect(() => {
    if (meus.current.has(peca.atualizado_em) || rev.current > 0 && estado !== 'salvo') return
    setR(rascunhoDaPeca(peca))
  }, [peca.atualizado_em]) // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = useCallback((c: Partial<Rascunho>) => { rev.current++; setR((x) => ({ ...x, ...c })); setEstado('alterado') }, [])

  const gravar = useCallback(async () => {
    const meuRev = rev.current, atual = rRef.current
    setEstado('salvando'); setErro(null)
    const quando = new Date().toISOString()
    meus.current.add(quando)
    const msg = await alterarPeca(peca.id, (p) => {
      const campos = camposDo(atual, p.tipo)
      const titulo = atual.titulo.trim() || p.titulo
      const foto = fotoDe(titulo, p.tipo, { ...p.conteudo, ...campos })
      const versoes = versoesDe(p)
      const ultima = versoes.at(-1)
      let novas: Versao[] = versoes
      if (!ultima || !iguais(ultima.dados, foto)) {
        if (ultima?.origem === 'manual' && minhaVersao.current === ultima.n) {
          novas = [...versoes.slice(0, -1), { ...ultima, em: quando, aprovada: false, dados: foto, nota: notaDe(versoes.at(-2)?.dados, foto) }]
        } else {
          const n = (ultima?.n ?? 0) + 1
          minhaVersao.current = n
          novas = [...versoes, { n, em: quando, por: nome, origem: 'manual', nota: notaDe(ultima?.dados, foto), dados: foto }]
        }
      }
      const reabre = textoMudou(ultima?.dados, foto) && (p.conteudo.aprovado_texto || p.status === 'aprovada')
      return {
        titulo, status: reabre && p.status === 'aprovada' ? 'rascunho' : p.status,
        conteudo: { ...p.conteudo, ...campos, versoes: novas.slice(-20), anterior: undefined, aprovado_texto: reabre ? undefined : p.conteudo.aprovado_texto, producao_ok: reabre ? undefined : p.conteudo.producao_ok },
      }
    }, quando)
    if (msg) { setErro(msg); setEstado('erro'); return false }
    setSalvoEm(quando)
    setEstado(rev.current === meuRev ? 'salvo' : 'alterado')
    aoMudar()
    return true
  }, [peca.id, nome, aoMudar])

  const salvar = useCallback(() => { const p = fila.current.then(gravar); fila.current = p.catch(() => null); return p }, [gravar])
  // descarrega o que estiver pendente antes de uma ação (aprovar, pedir ajuste ao agente)
  const salvarSeFaltar = useCallback(async () => (estado === 'alterado' || estado === 'erro' ? salvar() : fila.current.then(() => true)), [estado, salvar])

  useEffect(() => {
    if (estado !== 'alterado') return
    const t = setTimeout(salvar, 1500)
    return () => clearTimeout(t)
  }, [r, estado, salvar])

  // ações que mudam a situação: sempre salvam antes e leem a peça fresca
  const agir = useCallback(async (mudarLinha: (p: Linha, agora: { em: string; por: string }) => Partial<Linha>) => {
    if (!(await salvarSeFaltar())) return
    setErro(null)
    const msg = await alterarPeca(peca.id, (p) => mudarLinha(p, { em: new Date().toISOString(), por: nome }))
    if (msg) setErro(msg)
    minhaVersao.current = null
    aoMudar()
  }, [peca.id, nome, salvarSeFaltar, aoMudar])

  const semEtapa = (c: Record<string, unknown>) => { const { etapa: _e, ...resto } = c; return resto }
  const acoes = {
    aprovarTexto: () => agir((p, a) => {
      const versoes = versoesDe(p)
      const marcadas = versoes.map((v, i) => (i === versoes.length - 1 ? { ...v, aprovada: true } : v))
      return { conteudo: { ...semEtapa(p.conteudo), aprovado_texto: a, versoes: marcadas } }
    }),
    concluirProducao: () => agir((p, a) => ({ conteudo: { ...p.conteudo, producao_ok: a } })),
    aprovarPeca: () => agir((p) => ({ status: 'aprovada', conteudo: semEtapa(p.conteudo) })),
    publicar: () => agir(() => ({ status: 'postada' })),
    voltarRevisao: () => agir((p) => ({ status: 'rascunho', conteudo: { ...semEtapa(p.conteudo), aprovado_texto: undefined, producao_ok: undefined } })),
    reabrirProducao: () => agir((p) => ({ status: 'rascunho', conteudo: { ...p.conteudo, producao_ok: undefined } })),
    descartar: () => agir(() => ({ status: 'descartada' })),
    restaurar: (v: Versao) => agir((p, a) => {
      const versoes = versoesDe(p)
      const n = (versoes.at(-1)?.n ?? 0) + 1
      return {
        titulo: v.dados.titulo, tipo: v.dados.tipo, status: 'rascunho',
        conteudo: { ...semEtapa(p.conteudo), ...camposDaFoto(v.dados), aprovado_texto: undefined, producao_ok: undefined, anterior: undefined,
          versoes: [...versoes, { n, em: a.em, por: a.por, origem: 'restaurada', nota: `Restaurada da versão ${v.n}`, dados: v.dados }].slice(-20) },
      }
    }),
  }
  return { r, mudar, estado, salvoEm, erro, setErro, salvar, salvarSeFaltar, acoes, nome }
}
