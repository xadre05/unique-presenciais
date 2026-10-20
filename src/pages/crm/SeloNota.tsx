// Selo com a nota da pessoa (0 a 100), a temperatura e, quando importa, o tipo de pagador.
// Passando o mouse aparecem os motivos da nota.
import { Badge } from '../../components/ui'
import { PAGADOR, TEMPERATURA, tomDaNota, type NotaPessoa } from './nota'

type Props = { n: NotaPessoa | null | undefined; compacto?: boolean; semPagador?: boolean }

export function SeloNota({ n, compacto, semPagador }: Props) {
  if (!n || n.nota == null) return null
  const t = n.temperatura ? TEMPERATURA[n.temperatura] : null
  const pg = n.pagador ? PAGADOR[n.pagador] : null
  const mostraPagador = !semPagador && pg && n.pagador !== 'sem_historico' && (!compacto || n.pagador !== 'bom')
  const dica = [`Nota ${n.nota} de 100`, ...(n.motivos ?? []), t ? `Temperatura: ${t.rotulo.toLowerCase()} (${t.explica.toLowerCase()})` : ''].filter(Boolean).join('\n')
  return (
    <span className="selo-nota" title={dica}>
      <span className={`selo-nota-num selo-${tomDaNota(n.nota)}`}>{n.nota}</span>
      {t && <span className={`selo-temp selo-temp-${n.temperatura}`}>{t.rotulo}</span>}
      {mostraPagador && <Badge tom={pg.tom}>{pg.rotulo}</Badge>}
    </span>
  )
}
