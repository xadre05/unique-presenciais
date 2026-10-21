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
    id: 'aprovar', grupo: 'Criar conteúdo', titulo: 'Aprovar e ajustar peças',
    para: 'Decidir o que os agentes prepararam.',
    onde: { texto: 'Aprovações', link: '/agentes/aprovacoes' },
    passos: [
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
