// "Como usar" da área de Agentes: um guia curto por tarefa, com o caminho até a tela (link direto) e o passo a passo.
// Cada tela tem um botão "?" (BotaoAjuda) que abre o guia dela. Ao mudar uma tela, atualizar o guia aqui.
export type Guia = {
  id: string
  grupo: 'Começo' | 'Criar conteúdo' | 'Vídeo' | 'Ensinar os agentes' | 'Outros'
  titulo: string
  para: string
  onde: { texto: string; link: string }
  passos: string[]
  dicas?: string[]
  custo?: string
}

export const GUIAS: Guia[] = [
  {
    id: 'visao-geral', grupo: 'Começo', titulo: 'Como o sistema funciona',
    para: 'O caminho de um conteúdo, do planejamento ao resultado que ensina o agente.',
    onde: { texto: 'Sala dos agentes', link: '/agentes' },
    passos: [
      'Base da marca: o que os agentes precisam saber (quem é a empresa, produtos, como fala, campanhas e referências). Quanto mais completa, melhor o que eles escrevem.',
      'Planejar: no Agente de Marketing, "Planejar conteúdo" monta o calendário com você (conversando ou por pedido direto).',
      'Produção: cada peça passa por ideia → texto → arte ou vídeo → aprovação → agendada.',
      'Aprovações: tudo o que espera a sua decisão, de todos os agentes, num lugar só.',
      'Resultados: o Instagram é lido todo dia; o que funcionou vira aprendizado e o agente passa a seguir.',
    ],
  },
  {
    id: 'base-marca', grupo: 'Começo', titulo: 'Preencher a Base da marca',
    para: 'O que vale para todos os agentes: empresa, produtos, voz, rosto e visual.',
    onde: { texto: 'Base da marca → A marca', link: '/agentes/marca?aba=marca' },
    passos: [
      'Abra cada seção e preencha (quem é, o que vende sempre, para quem, como fala).',
      'Em "Voz", use o teste para ver um texto de exemplo e ajustar o tom.',
      'Salve na barra de baixo antes de trocar de aba.',
    ],
    dicas: ['Mudou um produto ou preço? Atualize aqui: os agentes leem esta base em toda escrita.'],
  },
  {
    id: 'campanhas', grupo: 'Começo', titulo: 'Cadastrar uma campanha e os roteiros',
    para: 'Ofertas com data (ex.: Black). Os materiais da campanha viram a base das peças dela.',
    onde: { texto: 'Base da marca → Campanhas', link: '/agentes/marca?aba=campanhas' },
    passos: [
      'Crie a campanha com nome, período, produto e o que pode e não pode ser dito.',
      'Em Materiais, suba a página de vendas, a copy e o PDF com os roteiros dos criativos (marque como "roteiro").',
      'Ao planejar ou editar um vídeo da campanha, o agente lê esses materiais inteiros.',
    ],
    dicas: ['O Editor de Vídeo descobre sozinho, pela fala, qual roteiro do PDF foi gravado.'],
  },
  {
    id: 'planejar', grupo: 'Criar conteúdo', titulo: 'Planejar conteúdo',
    para: 'Montar o calendário de posts de um dia, semana, mês ou campanha.',
    onde: { texto: 'Agente de Marketing → Planejar conteúdo', link: '/agentes/marketing' },
    passos: [
      'Clique em "Planejar conteúdo" e escolha o período, a campanha (se tiver) e os canais.',
      'Escolha como começar: reunião com o agente (ele pergunta e propõe), pedido direto (você já sabe o que quer) ou reaproveitar um post que teve resultado.',
      'Revise a proposta de calendário e aprove: as peças vão para Produção.',
      'Em Produção, abra cada peça para ver o texto, pedir ajuste, gerar a arte ou subir o vídeo.',
    ],
    custo: 'Uma peça custa centavos; um plano de mês, alguns reais. O gasto aparece em Configurações → Agentes.',
  },
  {
    id: 'fluxo-semana', grupo: 'Criar conteúdo', titulo: 'A semana com a social media',
    para: 'Como o conteúdo anda da ideia ao post, com cada pessoa fazendo a sua parte.',
    onde: { texto: 'Sala dos agentes', link: '/agentes' },
    passos: [
      'Na Sala, o recado da social media mostra o que é com você hoje: planejar a semana, aprovar pautas, gravar ou aprovar edições.',
      '"Planejar a semana" abre a reunião de pauta. Ela pergunta pelas campanhas, palestras, eventos e conteúdos de concorrentes que vocês gostaram, e monta o plano.',
      'A pauta (texto ou roteiro) vai para aprovação. Aprovada, os vídeos aparecem em "Para gravar", com o roteiro e o prazo para o vídeo chegar.',
      'Gravou? Em "Para gravar" (no celular mesmo), "Enviar o vídeo gravado". Ele sobe e cai na fila do Agente Editor de Vídeo.',
      'Quem edita abre o vídeo no Estúdio (ele baixa sozinho), edita e manda a prévia. A edição volta para aprovação e, aprovada, vai para agendar.',
      'Se o vídeo não chegar no prazo, a social media avisa que está atrasado.',
    ],
    dicas: ['Em Agente de Marketing → Configurar agente → Equipe e fluxo você define o nome da social media, quem grava, quem aprova e com quantos dias de antecedência o vídeo precisa chegar.', 'Os avisos também vão para o WhatsApp quando o número da social media estiver conectado.'],
  },
  {
    id: 'aprovar', grupo: 'Criar conteúdo', titulo: 'Aprovar e ajustar peças',
    para: 'Decidir o que os agentes prepararam.',
    onde: { texto: 'Aprovações', link: '/agentes/aprovacoes' },
    passos: [
      'Em Aprovações aparece uma linha por agente com o que espera você (pautas, vídeos para gravar, edições para aprovar). Clique na linha para decidir dentro do agente.',
      'Abra a peça, leia o texto e veja a arte.',
      'Para mudar, escreva o pedido de ajuste (ex.: "mais curto", "fala da turma de Brasília") e o agente refaz.',
      'Aprovou: a peça segue para agendar.',
    ],
  },
  {
    id: 'editar-video', grupo: 'Vídeo', titulo: 'Editar um vídeo',
    para: 'Qualquer vídeo gravado, de qualquer tamanho: criativo, reels ou avulso.',
    onde: { texto: 'Agente Editor de Vídeo → Vídeos', link: '/agentes/editor' },
    passos: [
      'Arraste o vídeo bruto em "Arraste um vídeo para editar" (ou "Selecionar vídeo"). Ele não sobe: fica no seu computador, e o navegador lembra dele mesmo depois de recarregar.',
      'Dê o nome, diga para que é (criativo de anúncio ou post) e a campanha, e clique em "Continuar para a edição". Abre o Estúdio.',
      'No Estúdio, confira as etapas à esquerda: vídeo bruto, conteúdo (roteiro opcional), estilo (o da casa, um salvo ou uma referência só para este vídeo) e imagens e música.',
      'Na última etapa, "Editar com o agente". A prévia aparece no meio, com a linha do tempo embaixo.',
      'Não gostou? Escreva à direita o que mudar e "Enviar". Cada ajuste vira uma versão (V1, V2…). Marque "vale como regra" para o que deve valer sempre.',
      '"Gerar vídeo final" monta o vídeo aqui no computador (deixe a aba aberta). Depois, "Concluir edição".',
      'Na tela de entrega, confira o destino e "Concluir e entregar": post planejado recebe o vídeo; vídeo avulso vai para o Marketing postar; criativo de anúncio vai para o Tráfego.',
    ],
    dicas: [
      'O Banco de imagens é para mídias de APOIO. O vídeo a editar vai sempre em "Arraste um vídeo para editar".',
      'O vídeo já veio editado? Na etapa Vídeo bruto, "Este vídeo já veio editado?" e conclua com ele como está.',
      'Gravou em partes? Escolha (ou arraste) todas de uma vez. O agente ouve cada parte e, pela fala e pelo roteiro, propõe a ordem e o que deixar de fora (ex.: uma tomada repetida). Confira, mude com as setas se quiser e "Juntar e continuar". As partes são emendadas sem perder qualidade.',
      'Tem o roteiro em PDF ou Word? Na entrada ("subir o roteiro") ou na etapa Conteúdo ("Subir o roteiro"). O agente usa o roteiro para ordenar as partes e para cortar as tomadas erradas.',
      'Depois de recarregar a página, escolha as mesmas partes de novo: o Estúdio reconhece e só junta, sem ouvir de novo nem custar nada.',
    ],
    custo: 'Cerca de R$ 0,30 a R$ 1 por edição de reels (transcrição + editor; mais mídias de apoio, mais perto de R$ 1). Cada ajuste custa parecido.',
  },
  {
    id: 'estilo-casa', grupo: 'Vídeo', titulo: 'Estilo da casa e Banco de imagens',
    para: 'O jeito padrão de editar todo vídeo e as mídias que o editor pode usar.',
    onde: { texto: 'Agente Editor de Vídeo → Estilo da casa', link: '/agentes/editor?aba=estilo' },
    passos: [
      'Em Estilo da casa, escolha a legenda (palavra por palavra ou palavras-chave), a quantidade de efeitos sonoros e de imagens, tela dividida e zoom.',
      'Escreva orientações livres (ex.: "nunca cobrir o rosto no gancho").',
      'Em Banco de imagens, suba fotos da turma, da plataforma, prints e depoimentos, com uma descrição curta de cada uma.',
    ],
    dicas: ['Descreva bem cada mídia: é pela descrição que o agente escolhe o momento certo de usar.'],
  },
  {
    id: 'cenas-broll', grupo: 'Vídeo', titulo: 'Cenas animadas e cenas geradas por IA',
    para: 'Deixar o vídeo com cara de editado por profissional: animações da marca e imagens que ilustram a fala.',
    onde: { texto: 'Estúdio → Imagens e música', link: '/agentes/editor' },
    passos: [
      'Cenas animadas: o agente cria sozinho, na edição, quando a fala tem número, lista, passo a passo, comparação, data ou oferta. Elas aparecem na linha do tempo com ✦.',
      'Antes de entregar, o próprio agente fotografa a cena, dá uma nota e corrige o que ficou feio. A nota aparece em Qualidade, à direita.',
      'Quer mais ou menos animação? Peça no ajuste (ex.: "anima o preço no final", "sem cena animada no gancho").',
      'Cenas geradas por IA: em Imagens e música, "Sugerir cenas para este vídeo". O agente lê a fala e propõe cenas reais que ilustram o que é dito.',
      'Em cada sugestão, "Gerar imagem". Gostou, "Usar a imagem" ou "Animar em clipe" (5 s com movimento de câmera) e depois "Usar o clipe".',
      'O que você usar entra na lista de mídias deste vídeo. Clique em "Editar com o agente" (ou peça um ajuste) para ele encaixar.',
    ],
    dicas: ['Gere a imagem primeiro e só anime as que valem: o clipe custa seis vezes mais.', 'As cenas geradas não têm rosto de pessoa real nem texto; antes e depois de paciente continua vindo do Banco, com autorização.'],
    custo: 'Cena animada: cerca de R$ 0,10 a R$ 0,30 cada (já incluída na edição). Imagem gerada: cerca de R$ 0,20. Clipe de 5 s: cerca de R$ 1,20 (Higgsfield).',
  },
  {
    id: 'cortes', grupo: 'Vídeo', titulo: 'Cortes de vídeo longo',
    para: 'Uma aula, live, podcast ou imersão vira vários reels.',
    onde: { texto: 'Agente Editor de Vídeo → Tem um vídeo longo?', link: '/agentes/editor/cortes' },
    passos: [
      'Escolha o vídeo longo (MP4 ou MOV, de qualquer tamanho). Ele não sobe: só o áudio é lido, aos pedaços, aqui no computador.',
      '"Transcrever" lê a fala em blocos de 10 minutos. Deixe a aba aberta; a transcrição fica guardada no navegador e não é paga de novo.',
      '"Encontrar os melhores trechos": o agente propõe os cortes com título, gancho, por que funciona e uma nota.',
      'Assista cada um, ajuste o começo e o fim de 1 em 1 segundo e marque os que quer.',
      '"Criar N vídeos": cada corte vai para "Em edição" com a fala já transcrita. Abra e edite no Estúdio como qualquer vídeo.',
    ],
    dicas: ['Use o Chrome ou o Edge: são os que leem o áudio de vídeos muito grandes aos pedaços.'],
    custo: 'Transcrição: cerca de R$ 2 por hora de vídeo. Escolha dos cortes: cerca de R$ 0,50 a R$ 1,50 por vídeo longo.',
  },
  {
    id: 'sem-gravar', grupo: 'Vídeo', titulo: 'Vídeo sem gravar',
    para: 'Um vídeo só com narração de IA, cenas animadas e imagens, sem ninguém gravar.',
    onde: { texto: 'Agente Editor de Vídeo → Vídeo sem gravar', link: '/agentes/editor/sem-gravar' },
    passos: [
      'Dê o título e escreva o texto como se fosse falar, com frases curtas.',
      'Escolha a voz (a seta toca uma amostra), a finalidade e a campanha.',
      '"Narrar com esta voz" e ouça. Não gostou? Mude o texto ou a voz e narre de novo.',
      '"Criar o vídeo e abrir no Estúdio". No Estúdio, "Editar com o agente": ele cobre o vídeo inteiro com cenas animadas e mídias do Banco.',
      'Para ficar mais rico, gere cenas por IA em Imagens e música antes de editar.',
    ],
    dicas: ['A chave da ElevenLabs fica em Configurações → Inteligências artificiais.'],
    custo: 'Narração: cerca de R$ 1,70 a cada 1.000 caracteres (uns 45 s de fala), mais a edição.',
  },
  {
    id: 'estudar-canal', grupo: 'Ensinar os agentes', titulo: 'Estudar um canal',
    para: 'Ensinar o estilo de um canal do YouTube ou do Instagram de que você gosta.',
    onde: { texto: 'Base da marca → Conhecimento → Estudar um canal', link: '/agentes/marca?aba=conhecimento&ref=canal' },
    passos: [
      'Baixe de 3 a 10 vídeos do canal (o sistema não baixa do YouTube nem do Instagram).',
      'Preencha o nome do canal, o link e o formato (vídeos longos ou reels).',
      'Arraste os vídeos baixados: o navegador tira as imagens, mede os cortes e transcreve a fala.',
      'Escreva o que você gosta nele (ex.: "o ritmo", "as palavras-chave em caixa") e clique em Estudar.',
      'Pronto: a ficha do canal aparece em Referências de criação e pode ser escolhida no Editor em "Estilo".',
    ],
    dicas: ['O agente copia a forma, nunca as frases, dados ou bordões de quem fez.'],
    custo: 'Cerca de R$ 0,50 por vídeo estudado (um canal com 6 vídeos fica perto de R$ 3).',
  },
  {
    id: 'nova-referencia', grupo: 'Ensinar os agentes', titulo: 'Guardar uma referência avulsa',
    para: 'Um post, arte ou vídeo de terceiros que serve de modelo.',
    onde: { texto: 'Base da marca → Conhecimento → Nova referência', link: '/agentes/marca?aba=conhecimento&ref=nova' },
    passos: [
      'Dê um nome, diga de onde é e o formato.',
      'Suba as imagens ou o vídeo (ou cole o link e o texto).',
      'Diga por que serve de modelo. O agente estuda e gera a ficha.',
    ],
  },
  {
    id: 'nossos-campeoes', grupo: 'Ensinar os agentes', titulo: 'Ensinar os nossos criativos que deram resultado',
    para: 'O agente aprende o roteiro do que a própria marca já fez e funcionou.',
    onde: { texto: 'Base da marca → Conhecimento → Nossos criativos que deram resultado', link: '/agentes/marca?aba=conhecimento' },
    passos: [
      'Aba "Posts do Instagram": escolha o formato e a métrica (alcance, salvos…). O ranking compara cada post com os da mesma época.',
      'Clique em "Ensinar os 10 primeiros" ou em "Ensinar" num post: o agente busca o post, ouve a fala e aprende o roteiro.',
      'Aba "Anúncios que venderam": vem das vendas da Hotmart. Em "Ensinar o roteiro", suba o vídeo do anúncio ou cole o texto.',
      'O que foi ensinado entra na memória do Agente de Marketing e ele parte disso nos próximos roteiros.',
    ],
    custo: 'Cerca de R$ 0,30 por post.',
  },
  {
    id: 'aprendizados', grupo: 'Ensinar os agentes', titulo: 'Ensinar pelos resultados do Instagram',
    para: 'Transformar o que funcionou (ou não) em regra para o agente.',
    onde: { texto: 'Agente de Marketing → Resultados → Aprendizados', link: '/agentes/marketing?aba=resultados&ver=aprendizados' },
    passos: [
      'Em Período ou Comparações, peça a análise: o agente aponta o que funcionou.',
      'Em Aprendizados, leia cada um e clique em "Ensinar" nos que valem como regra.',
      'Ligue a revisão semanal para o agente analisar sozinho toda semana.',
    ],
    dicas: ['Aprendizado que não foi ensinado não muda nada: o agente só segue o que está na memória dele.'],
  },
  {
    id: 'automacoes', grupo: 'Outros', titulo: 'Automação de comentário → direct',
    para: 'Quem comenta uma palavra no post recebe uma mensagem no direct com link, PDF ou WhatsApp.',
    onde: { texto: 'Automações', link: '/agentes/automacoes' },
    passos: [
      'Crie a automação para um post e escolha a palavra-chave (ex.: BLACK) ou "qualquer comentário".',
      'Escreva a mensagem e o que vai junto (link, PDF ou WhatsApp).',
      'Ligue e teste comentando a palavra no post com a sua conta. Os envios aparecem na própria automação.',
    ],
  },
  {
    id: 'configuracoes', grupo: 'Outros', titulo: 'Chaves, integrações e gastos',
    para: 'Ligar as contas de fora e acompanhar quanto cada agente gasta.',
    onde: { texto: 'Configurações', link: '/agentes/central' },
    passos: [
      'IAs: as chaves do Claude e da OpenAI (quem cadastra é o administrador, na própria tela).',
      'Integrações: o Instagram (posts, métricas e publicação).',
      'Agentes: quais estão ligados e o gasto de cada um no mês.',
    ],
  },
]

export const guia = (id: string) => GUIAS.find((g) => g.id === id)
