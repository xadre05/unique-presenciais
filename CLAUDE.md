# Unique Comercial — regras para quem desenvolve (Claude ou qualquer pessoa)

## O quadro do projeto é a fonte da verdade
O desenvolvimento do ecossistema é controlado em **Controle → Projeto do ecossistema** (tabelas `proj_epicos`, `proj_entregas`, `proj_tarefas`, `proj_ideias`). Toda sessão de trabalho segue isto:

1. **Antes de começar**: ler o quadro (entregas `semana`, `construindo`, `testar`) e a caixa de ideias. Trabalhar só no que está na semana, no máximo 2 entregas abertas.
2. **Ideia nova do Alexandre no meio da conversa**: registrar em `proj_ideias` (uma linha, nas palavras dele) e avisar "anotado". Não parar a entrega atual. Exceção: algo quebrado que trava o trabalho ou urgência de dinheiro.
3. **Ideia que é claramente parte de uma entrega aberta e é pequena**: virar tarefa dessa entrega e avisar que o escopo mudou.
4. **Ao começar uma entrega**: `status = 'construindo'`; criar as tarefas (quem: claude / alexandre / equipe).
5. **Decisão tomada na conversa**: anotar em `proj_entregas.notas` com a data (ex.: "23/10 — vitalícios primeiro; devedores fora").
6. **Ao terminar e publicar**: marcar as tarefas feitas, `status = 'testar'` e escrever `resumo` (o que mudou, em linguagem simples). Quem passa para `publicado` é o Alexandre, depois de testar.
7. **Semana**: vai de domingo a sábado. No domingo se escolhe o que entra.

## Regras fixas
- Responder em português, sem jargão técnico.
- Banco de produção é compartilhado: só mudanças que acrescentam; nunca apagar dado sem pedido explícito.
- Nunca usar "grátis"/"gratuito". Nenhum nome de pessoa na interface do produto.
- Publicar: `git push origin dev && git push origin dev:main`.
