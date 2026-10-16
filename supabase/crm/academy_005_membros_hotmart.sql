-- 066: área de membros da Hotmart (Club), lida pela função hotmart (acao "membros", só leitura).
create table if not exists hotmart_membros (
  subdominio text not null, user_id text not null, email text, nome text, status text, papel text,
  primeiro_acesso timestamptz, ultimo_acesso timestamptz, progresso numeric, engajamento text, bruto jsonb,
  sincronizado_em timestamptz not null default now(), primary key (subdominio, user_id)
);
create index if not exists hotmart_membros_email on hotmart_membros (lower(email));
alter table hotmart_membros enable row level security;
create policy hotmart_membros_admin on hotmart_membros for select using ((select is_admin()));
