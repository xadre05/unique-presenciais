// Aba "Configurações" de Cobranças (administrador): e-mail de envio, banco do boleto, IA de cobrança, dados da empresa,
// travas, modelos da carta e do WhatsApp e os limites do acordo, tudo num lugar só.
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import type { Config } from './modelo'
import { ConfigNotificacao } from './ConfigNotificacao'

export function ConfiguracoesCobranca({ eu }: { eu: string }) {
  const cfg = useConsulta<Config>(() => supabase.from('cobranca_config').select('*').single(), [])
  if (cfg.erro) return <Erro msg={cfg.erro} />
  if (!cfg.dados) return <p className="muted">Carregando…</p>
  // a chave força recomeçar o formulário com o que acabou de ser salvo
  return <ConfigNotificacao key={String(cfg.dados.atualizado_em ?? '')} cfg={cfg.dados} eu={eu} inline aoSalvar={cfg.recarregar} />
}
