// Bloco de credenciais de uma integração dentro de "Dados, modelos e travas": os campos (texto, segredo ou arquivo),
// gravados cifrados no cofre do banco (a tela nunca mostra de volta), e os botões de ação (teste etc.).
import { useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { Badge, Campo, Erro } from '../../../components/ui'

export type CampoCred = { k: string; r: string; d: string; exemplo?: string; secreto?: boolean; arquivo?: string; opcional?: boolean }
export type AcaoCred = { rotulo: string; fazer: () => Promise<string> }
type Props = { integracao: string; titulo: string; campos: CampoCred[]; acoes: AcaoCred[]; rodape?: ReactNode }

export function BlocoCredenciais({ integracao, titulo, campos, acoes, rodape }: Props) {
  const salvos = useConsulta<string[]>(() => supabase.rpc('campos_integracao', { p_integracao: integracao }), [integracao])
  const [v, setV] = useState<Record<string, string>>({})
  const [arquivos, setArquivos] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const lista = salvos.dados ?? []
  const completo = campos.filter((c) => !c.opcional).every((c) => lista.includes(c.k))

  const lerArquivo = async (k: string, f: File) => {
    const texto = (await f.text()).trim()
    if (!/-----BEGIN [A-Z ]+-----/.test(texto)) return setErro(`"${f.name}" não parece um certificado ou chave (.crt / .key). Se veio num .zip, descompacte antes.`)
    setErro(null); setV((x) => ({ ...x, [k]: texto })); setArquivos((x) => ({ ...x, [k]: f.name }))
  }
  const salvar = async () => {
    const preenchidos = Object.entries(v).filter(([, x]) => x.trim())
    if (!preenchidos.length) return setErro('Preencha ao menos um campo.')
    setOcupado(true); setErro(null); setAviso(null)
    for (const [k, x] of preenchidos) {
      const { error } = await supabase.rpc('salvar_credencial_integracao', { p_integracao: integracao, p_campo: k, p_valor: x })
      if (error) { setOcupado(false); return setErro(msgErro(error)) }
    }
    setV({}); setArquivos({}); setOcupado(false); setAviso('Salvo.'); salvos.recarregar()
  }
  const agir = async (a: AcaoCred) => {
    setOcupado(true); setErro(null); setAviso(`${a.rotulo}…`)
    try { setAviso(await a.fazer()) } catch (e) { setAviso(null); setErro(e instanceof Error ? e.message : 'Não deu certo.') } finally { setOcupado(false) }
  }

  return (
    <section className="not-email">
      <div className="bloco-topo"><h3>{titulo}</h3>
        <Badge tom={completo ? 'ok' : lista.length ? 'alerta' : 'neutro'}>{completo ? 'configurado' : lista.length ? 'incompleto' : 'não configurado'}</Badge></div>
      <div className="not-config">
        {campos.map((c) => (
          <Campo key={c.k} rotulo={`${c.r}${lista.includes(c.k) ? ' ✓' : ''}`} dica={c.d}>
            {c.arquivo ? (
              <label className="btn btn-contorno btn-mini not-arquivo">{arquivos[c.k] ?? (lista.includes(c.k) ? 'Trocar arquivo' : 'Escolher arquivo')}
                <input type="file" accept={c.arquivo} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(c.k, f); e.target.value = '' }} /></label>
            ) : (
              // sem type=password: o navegador não preenche sozinho o login e a senha de quem está usando o sistema
              <input type="text" name={`${integracao}-${c.k}`} autoComplete="off" data-lpignore="true" data-1p-ignore spellCheck={false}
                className={c.secreto ? 'campo-secreto' : undefined} value={v[c.k] ?? ''} placeholder={lista.includes(c.k) ? '(já cadastrado: deixe vazio para manter)' : c.exemplo ?? 'Cole aqui'}
                onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
            )}
          </Campo>
        ))}
      </div>
      {rodape}
      <div className="acoes">
        <button type="button" className="btn btn-contorno btn-mini" disabled={ocupado} onClick={salvar}>Salvar</button>
        {acoes.map((a) => <button key={a.rotulo} type="button" className="btn btn-mini" disabled={ocupado || !completo} onClick={() => agir(a)}>{a.rotulo}</button>)}
        {aviso && <span className="muted pequeno">{aviso}</span>}
      </div>
      <Erro msg={erro} />
    </section>
  )
}

