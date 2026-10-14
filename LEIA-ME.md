# Unique Presenciais

Controle de turmas, matrículas, pagamentos e comissões dos cursos presenciais.

## Rodar no computador (teste local)

1. Abra o terminal nesta pasta.
2. `npm install` (só na primeira vez).
3. `npm run dev`
4. Abra **http://localhost:5174** (o Unique Clinical continua na 5173).

O sistema já aponta para o banco **unique-presenciais** (Supabase, organização "Projetos Novos", servidor de São Paulo).

## Primeiro acesso

1. Na tela de entrada, clique em **Criar minha conta**, use seu e-mail e confirme pelo link que chega no e-mail.
2. O primeiro administrador é liberado direto no banco. Depois disso, você libera a Mayara e a Natália em **Equipe e cadastros**: escolha "Vendedora" e ligue cada login ao nome dela na lista de vendedoras (é assim que a comissão e o "quem vendeu" saem automaticamente).

## Regras do sistema

- **Ninguém apaga nada.** Matrícula ou parcela que sai é cancelada com motivo. Tudo fica no Histórico (quem, quando, antes e depois).
- **Só conta como recebido o que foi conferido.** A vendedora informa o pagamento (com comprovante, obrigatório para Pix) e ele fica "aguardando conferência". Só o administrador confirma o recebimento, depois de ver no extrato ou na Hotmart.
- **Comissão:** R$ 250 por aluno, para quem vendeu. Nasce "pendente" em toda matrícula de venda. O administrador libera quando a inscrição é confirmada; liberada, vai para o pagamento do mês seguinte. Se só a matrícula foi paga, fica pendente, mas pode ser liberada manualmente. Matrícula cancelada cancela a comissão que ainda não foi paga.
- **Hotmart:** vendas novas vão pela conta Unique HOF Academy. A conta Patrícia Regina Academy fica só para os parcelamentos antigos.

## Estrutura

- `src/pages/` telas (Painel, Turmas, Matrícula, Nova matrícula, Pagamentos, Alunos, Comissões, Histórico, Equipe)
- `supabase/` estrutura do banco (tabelas, regras de acesso, histórico)
