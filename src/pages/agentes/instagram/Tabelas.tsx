// Tabelas dos Resultados do Instagram: por formato (no filtro escolhido) e comparação entre os anos.
import { NOME_TIPO, mediana, milhar, n, type PostIG } from './dados'
const media = (ps: PostIG[], k: keyof PostIG['metricas']) => Math.round(ps.reduce((s, p) => s + n(p, k), 0) / Math.max(1, ps.length))
const resumo = (ps: PostIG[]) => ({ qtd: ps.length, alcance: mediana(ps.map((p) => n(p, 'alcance'))), salvos: media(ps, 'salvos'), comp: media(ps, 'compartilhamentos') })

export function PorFormato({ posts }: { posts: PostIG[] }) {
  const linhas = [...new Set(posts.map((p) => p.tipo))].map((t) => ({ t, ...resumo(posts.filter((p) => p.tipo === t)) })).sort((a, b) => b.alcance - a.alcance)
  return (
    <table className="tabela ig-tabela">
      <thead><tr><th>Formato</th><th>Posts</th><th>Alcance mediano</th><th>Salvos por post</th><th>Compartilhamentos por post</th></tr></thead>
      <tbody>{linhas.map((l) => <tr key={l.t}><td>{NOME_TIPO[l.t] ?? l.t}</td><td>{l.qtd}</td><td>{milhar(l.alcance)}</td><td>{milhar(l.salvos)}</td><td>{milhar(l.comp)}</td></tr>)}</tbody>
    </table>
  )
}

// um ano por linha, com o formato que teve o maior alcance mediano naquele ano
export function ComparaAnos({ posts }: { posts: PostIG[] }) {
  const anos = [...new Set(posts.map((p) => p.publicado_em.slice(0, 4)))].sort().reverse()
  const linhas = anos.map((a) => {
    const doAno = posts.filter((p) => p.publicado_em.startsWith(a))
    const formatos = [...new Set(doAno.map((p) => p.tipo))].map((t) => ({ t, ...resumo(doAno.filter((p) => p.tipo === t)) })).filter((f) => f.qtd >= 3).sort((x, y) => y.alcance - x.alcance)
    return { a, ...resumo(doAno), melhor: formatos[0] }
  })
  return (
    <table className="tabela ig-tabela">
      <thead><tr><th>Ano</th><th>Posts</th><th>Alcance mediano</th><th>Salvos por post</th><th>Compartilhamentos por post</th><th>Formato que mais alcançou</th></tr></thead>
      <tbody>{linhas.map((l) => <tr key={l.a}><td><b>{l.a}</b></td><td>{l.qtd}</td><td>{milhar(l.alcance)}</td><td>{milhar(l.salvos)}</td><td>{milhar(l.comp)}</td>
        <td>{l.melhor ? `${NOME_TIPO[l.melhor.t] ?? l.melhor.t} (${milhar(l.melhor.alcance)})` : '—'}</td></tr>)}</tbody>
    </table>
  )
}
