-- 21/10/2026 · Dois agentes novos, cada um contratado à parte:
--  * editor: Editor de Vídeo. Recebe o vídeo gravado (de uma peça do Marketing ou solto), transcreve, corta pelo
--    roteiro, coloca legenda, textos na tela e zoom. O vídeo não fica no banco: só a "receita" da edição vai na peça.
--    O custo (transcrição + edição) é lançado no agente editor, não no marketing.
--  * web: Web Designer (em breve). Páginas de venda e sites, publicação, domínio e DNS.
-- Ter o agente = agentes_empresa.ativo; sem ele, a tela mostra o convite para contratar.
insert into agentes (id, nome, papel, descricao, ordem, disponivel, visivel) values
('editor','Editor de Vídeo','Edição de reels e vídeos','Recebe o vídeo gravado, corta pelo roteiro, coloca legenda, textos na tela e zoom, e entrega o vídeo pronto para postar.',2,true,true),
('web','Web Designer','Páginas, sites e domínios','Cria e ajusta páginas de venda e sites, publica e cuida de domínio e DNS.',9,false,true)
on conflict (id) do nothing;

-- a Unique já usa o editor
insert into agentes_empresa (empresa_id, agente_id, ativo) values ('a0000000-0000-4000-8000-000000000001','editor',true)
on conflict (empresa_id, agente_id) do nothing;
