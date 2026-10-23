-- Carga inicial do Controle → Projeto: tudo o que foi conversado até 22/10/2026, triado por épico.
-- Só roda se ainda não houver épicos (não duplica).
do $$
declare e uuid; x uuid;
begin
  if exists (select 1 from proj_epicos) then return; end if;

  -- helpers inline: épico, depois entregas (status, ordem)
  insert into proj_epicos (nome, descricao, fase, ordem, status) values
    ('Cobrança e caixa', 'Recuperar as dívidas antigas e recentes para dar fôlego de caixa à Black.', 1, 0, 'andamento') returning id into e;
  insert into proj_entregas (epico_id, nome, status, ordem, publicado_em, semana) values
    (e, 'Carta de notificação com nome fantasia e CNPJ certo pela data da compra', 'publicado', 0, now(), null),
    (e, 'Asaas ligado: boleto, Pix e negativação', 'publicado', 1, now(), null),
    (e, 'Configurações da cobrança num lugar só', 'publicado', 2, now(), null);
  insert into proj_entregas (epico_id, nome, pronto_quando, status, ordem, semana) values
    (e, 'Modelos de utilidade da cobrança aprovados na Meta', 'Aviso da carta e lembretes da régua aprovados no número oficial', 'semana', 3, date_trunc('week', current_date + 1)::date - 1)
    returning id into x;
  insert into proj_tarefas (entrega_id, titulo, quem, ordem) values
    (x, 'Escrever os modelos de aviso e lembrete', 'claude', 0), (x, 'Mandar para aprovação da Meta', 'claude', 1), (x, 'Conferir o texto', 'alexandre', 2);
  insert into proj_entregas (epico_id, nome, status, ordem) values
    (e, 'IA de cobrança falando pelo número oficial', 'espera', 4),
    (e, 'Régua das 86 dívidas recentes', 'espera', 5),
    (e, 'Revisar as 24 marcadas "Conferir na Hotmart"', 'espera', 6),
    (e, 'Cartas das dívidas antigas (depois das respostas da Hotmart e do advogado)', 'espera', 7);

  insert into proj_epicos (nome, descricao, fase, ordem, status) values
    ('Atendimento e conversas', 'Caixa de conversas de WhatsApp da equipe, com controle de quem atende e de quanto demora.', 1, 1, 'andamento') returning id into e;
  insert into proj_entregas (epico_id, nome, status, ordem, publicado_em) values
    (e, 'Número oficial 9888-0029 ligado (recebe e envia)', 'publicado', 0, now()),
    (e, 'Caixa de conversas nova: mídia, modelos da Meta, adiar, agendar, resumo da IA, Ctrl+K', 'publicado', 1, now()),
    (e, 'Contatos duplicados: juntar com um clique', 'publicado', 2, now());
  insert into proj_entregas (epico_id, nome, pronto_quando, status, ordem, semana) values
    (e, 'Terminar a tela de Conversas e a Minha fila', 'Minha fila mostra só o que é real (sem o número de teste) e a tela não quebra no computador nem no celular', 'semana', 3, date_trunc('week', current_date + 1)::date - 1);
  insert into proj_entregas (epico_id, nome, status, ordem) values
    (e, 'Números das vendedoras dentro do sistema', 'espera', 4),
    (e, 'Controle das vendedoras: tempo de resposta, conversas paradas, vendas e comissão', 'espera', 5);

  insert into proj_epicos (nome, descricao, fase, ordem, status) values
    ('Disparos e públicos da Black', 'Mandar a Black para o público certo pelo número oficial e saber quem recebeu, leu, respondeu e comprou.', 1, 2, 'andamento') returning id into e;
  insert into proj_entregas (epico_id, nome, pronto_quando, status, ordem, semana) values
    (e, 'Públicos salvos + disparo com modelo da Meta + etiquetas de rastreio', 'Consigo salvar "alunos vitalícios", disparar um modelo aprovado e ver as etiquetas recebeu, leu, respondeu e comprou', 'semana', 0, date_trunc('week', current_date + 1)::date - 1)
    returning id into x;
  insert into proj_tarefas (entrega_id, titulo, quem, ordem) values
    (x, 'Banco: públicos, disparo com modelo, etiquetas automáticas', 'claude', 0), (x, 'Tela: salvar público e escolher modelo no disparo', 'claude', 1),
    (x, 'Servidor: enviar o modelo na fila do disparo', 'claude', 2), (x, 'Testar com um público pequeno', 'alexandre', 3);
  insert into proj_entregas (epico_id, nome, pronto_quando, status, ordem, semana) values
    (e, 'Modelos da Black escritos pela IA a partir da campanha', 'A IA lê a campanha da Black e propõe modelos; mando para a Meta com um clique', 'semana', 1, date_trunc('week', current_date + 1)::date - 1);
  insert into proj_entregas (epico_id, nome, status, ordem) values
    (e, 'Painel da Black: meta x realizado por dia, vendedora e origem', 'espera', 2),
    (e, 'Recuperação automática: boleto, Pix, carrinho abandonado e lead da página', 'espera', 3),
    (e, 'IA de vendas sugerindo respostas da Black nas conversas', 'espera', 4);

  insert into proj_epicos (nome, descricao, fase, ordem, status) values
    ('Fábrica de software', 'Como o ecossistema é desenvolvido: épicos, entregas da semana e caixa de ideias.', 1, 3, 'andamento') returning id into e;
  insert into proj_entregas (epico_id, nome, pronto_quando, status, ordem, semana) values
    (e, 'Área "Projeto do ecossistema" no Controle', 'Vejo as fases, o quadro da semana, os épicos e a caixa de ideias, e consigo mover e triar', 'testar', 0, date_trunc('week', current_date + 1)::date - 1);

  insert into proj_epicos (nome, descricao, fase, ordem) values
    ('Motor de automações', 'Um motor só (Quando → Faça → Depois) para WhatsApp, e-mail e Instagram, com rastreio por etiqueta.', 2, 0) returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'Juntar cadências, disparos, cobrança e Instagram num motor só', 0),
    (e, 'Eventos da Hotmart como gatilho (compra, boleto, carrinho, reembolso)', 1),
    (e, 'E-mail em massa com domínio autenticado', 2),
    (e, 'Galeria de receitas prontas (ex.: boleto vencido → mensagem → IA de vendas)', 3);

  insert into proj_epicos (nome, descricao, fase, ordem) values
    ('Base de conhecimento e SPIN', 'O que funciona nas conversas vira base para todas as IAs e respostas prontas para a equipe.', 3, 0) returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'Aprender com todas as conversas, cruzando com quem comprou', 0),
    (e, 'Sugestões semanais de respostas prontas e modelos', 1),
    (e, 'SPIN Selling nas conversas (em que etapa cada uma parou)', 2);

  insert into proj_epicos (nome, descricao, fase, ordem) values
    ('Agentes de vendas, atendimento e sucesso do aluno', 'Agentes que atendem, vendem e acompanham o aluno até o próximo degrau.', 3, 1) returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'IA de vendas respondendo sozinha onde for liberado', 0),
    (e, 'Agente de atendimento (porta de entrada)', 1),
    (e, 'Sucesso do aluno: acompanhar e indicar o próximo produto', 2);

  insert into proj_epicos (nome, descricao, fase, ordem, status) values
    ('Agente de marketing', 'Social media de IA: planeja, cria, edita, posta e aprende com o resultado.', 3, 2, 'andamento') returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'Editor de vídeo para Reels', 0), (e, 'Testar a postagem feita pelo agente', 1),
    (e, 'Shorts do YouTube e TikTok', 2), (e, 'Social media pelo WhatsApp (pauta diária e cobrança do vídeo)', 3);

  insert into proj_epicos (nome, descricao, fase, ordem) values
    ('Planejador de campanhas e lançamentos', 'Planejar com meta e orçamento por etapa, executar, acompanhar e analisar.', 4, 0) returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'Modelos de lançamento: pago, tradicional, reunião, perpétuo, Black', 0),
    (e, 'Meta e orçamento por etapa', 1),
    (e, 'Relatório meta x resultado, com o porquê do que não bateu', 2);

  insert into proj_epicos (nome, descricao, fase, ordem) values
    ('Agenda Cheia', 'O mini-ecossistema na clínica do aluno: agentes que atendem, vendem e agendam, dentro do Unique Clinical.', 5, 0) returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'Validar na clínica-piloto (encher a agenda)', 0),
    (e, 'Pedir a aprovação da Meta para atender várias clínicas', 1),
    (e, 'Agenda Cheia dentro do Unique Clinical', 2);

  insert into proj_epicos (nome, descricao, fase, ordem) values
    ('Clube próprio', 'Área de membros, cursos e comunidade sem depender da Hotmart.', 5, 1) returning id into e;
  insert into proj_entregas (epico_id, nome, ordem) values
    (e, 'Área de membros e cursos', 0), (e, 'Comunidade', 1), (e, 'Pagamento, nota fiscal e vídeo próprios', 2);

  insert into proj_ideias (texto) values
    ('Estudar o modelo de negócio do Rick Novak e dos donos da Fluence'),
    ('Unique HOF Creators'),
    ('Abrir o ecossistema para dentistas'),
    ('Meta de R$ 200 milhões por ano: a conta e o que precisa ser verdade em cada fase');
end $$;
