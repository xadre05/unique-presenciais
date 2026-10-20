-- ════════════════════════════════════════════════════════════════════
-- Controle → monitor automático: o sistema confere sozinho, a cada 30 minutos, se cada coisa está de pé.
-- Tipos: site (abre e responde?), dominio (vence quando? Registro.br), anthropic / openai (chave e crédito),
-- supabase (uso do plano). O resultado fica na própria linha (nivel, detalhe, verificado_em, desde).
-- ════════════════════════════════════════════════════════════════════
create table public.controle_monitores (
  id text primary key,
  nome text not null,
  tipo text not null check (tipo in ('site','dominio','anthropic','openai','supabase')),
  alvo text,
  servico text,                                   -- nome em controle_servicos (para mostrar junto)
  ativo boolean not null default true,
  ordem int not null default 0,
  nivel text check (nivel in ('ok','alerta','erro')),
  detalhe text,
  valor jsonb,
  verificado_em timestamptz,
  desde timestamptz                               -- desde quando está nesse nível
);
alter table public.controle_monitores enable row level security;
create policy controle_monitores_admin on public.controle_monitores for all using (is_admin()) with check (is_admin());

insert into public.controle_monitores (id, nome, tipo, alvo, servico, ordem) values
  ('site:sistema', 'Sistema da Unique', 'site', 'https://unique-presenciais.vercel.app', 'Vercel', 10),
  ('site:black', 'Página da Black', 'site', 'https://uniquehofacademy.com.br/black/', 'StayCloud', 20),
  ('site:perpetuo', 'Página do perpétuo', 'site', 'https://uniquehofclub.com.br/academy/', null, 30),
  ('site:patricia', 'Site da Dra. Patrícia', 'site', 'https://drapatriciaregina.com.br', 'StayCloud', 40),
  ('dominio:uniquehofacademy', 'uniquehofacademy.com.br', 'dominio', 'uniquehofacademy.com.br', null, 50),
  ('dominio:uniquehofclub', 'uniquehofclub.com.br', 'dominio', 'uniquehofclub.com.br', null, 60),
  ('dominio:drapatriciaregina', 'drapatriciaregina.com.br', 'dominio', 'drapatriciaregina.com.br', null, 70),
  ('ia:anthropic', 'Claude (Anthropic)', 'anthropic', null, 'Anthropic (Claude)', 80),
  ('ia:openai', 'OpenAI', 'openai', null, 'OpenAI', 90),
  ('banco:supabase', 'Banco de dados (Supabase)', 'supabase', null, 'Supabase', 100);

-- uso do banco (para o monitor; só o serviço interno chama)
create function public.controle_uso_banco() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('banco_bytes', pg_database_size(current_database()),
    'arquivos_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0))
$$;
revoke execute on function public.controle_uso_banco() from public, anon, authenticated;

-- a cada 30 minutos
select cron.schedule('controle-monitor', '*/30 * * * *', $cron$
  select net.http_post(
    url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/controle-monitor',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-chave', (select decrypted_secret from vault.decrypted_secrets where name = 'integ:sistema:cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$cron$);
