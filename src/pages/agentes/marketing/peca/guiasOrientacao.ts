// Guias para escrever orientações em cada formato (arte, capa, gravação, cena, bloco, pauta, transmissão, página,
// diagramação, seção) e sugestões rápidas para o "Pedir ajuste à IA" em cada formato de peça.
// As frases usam as pessoas e imagens da própria peça: nada fixo de uma empresa.

export type Uso = 'arte' | 'tela' | 'capa' | 'gravacao' | 'transmissao' | 'cena' | 'bloco' | 'pauta' | 'pagina' | 'diagramacao' | 'secao'
export type Contexto = { pessoas: string[]; imagens: string[]; tipo: string }
export type GrupoFrases = { nome: string; frases: string[] }
type Guia = { checklist: string; grupos: (c: Contexto) => GrupoFrases[]; exemplo: (c: Contexto) => string }

const pessoa = (c: Contexto) => c.pessoas[0] ?? 'A pessoa escolhida'
const imagem = (c: Contexto) => c.imagens[0] ?? 'o logo do produto'
const ROUPA = ['roupa: jaleco branco', 'roupa: blazer preto', 'roupa: blazer branco', 'roupa nas cores da marca']
const CENARIO = ['fundo escuro liso', 'consultório elegante', 'estúdio com luz suave', 'fundo desfocado', 'cores da marca no fundo']
const LUZ_GRAVACAO = ['luz natural de frente (janela)', 'ring light na altura do rosto', 'consultório arrumado ao fundo', 'sem barulho de fundo']
const CUIDADOS = ['procedimento só aparece com autorização do paciente', 'sem promessa de resultado (regras do conselho)']
const comPessoas = (c: Contexto, frases: (p: string) => string[]): GrupoFrases[] =>
  c.pessoas.length ? [{ nome: 'Quem aparece', frases: c.pessoas.flatMap(frases) }, { nome: 'Roupa', frases: ROUPA }] : []
const comImagens = (c: Contexto, frases: (n: string) => string[]): GrupoFrases[] =>
  c.imagens.length ? [{ nome: 'Imagens desta peça', frases: c.imagens.flatMap(frases) }] : []

const GUIAS: Record<Uso, Guia> = {
  arte: {
    checklist: 'quem aparece e onde · roupa e expressão · cenário e luz · onde vai cada imagem · o que destacar no texto',
    grupos: (c) => [
      ...comPessoas(c, (p) => [`${p} em primeiro plano, meio corpo, sorrindo`, `${p} ao fundo, à direita`, `${p} olhando para o título`]),
      ...comImagens(c, (n) => [`${n} embaixo, ao centro`, `${n} à direita, em destaque`]),
      { nome: 'Cenário e luz', frases: CENARIO },
      { nome: 'Texto', frases: ['título grande no topo', 'pouco texto e bastante respiro', 'destaque em dourado na palavra principal', 'texto de apoio pequeno, embaixo'] },
    ],
    exemplo: (c) => `${pessoa(c)} em primeiro plano, à esquerda, meio corpo, sorrindo; roupa: blazer branco; fundo escuro liso com luz suave; ${imagem(c)} embaixo, ao centro; título grande no topo e o texto de apoio pequeno, embaixo.`,
  },
  tela: {
    checklist: 'o que aparece na tela (foto, vídeo ou só texto) · quem aparece · a interação (enquete, caixinha, link) · onde fica o texto',
    grupos: (c) => [
      { nome: 'Formato da tela', frases: ['só texto grande no centro', 'foto de bastidor no fundo', 'vídeo curto falando para a câmera', 'print de depoimento (com autorização)'] },
      ...comPessoas(c, (p) => [`${p} falando para a câmera`, `${p} em foto de bastidor`]),
      { nome: 'Interação', frases: ['figurinha de enquete com 2 opções', 'caixinha de perguntas', 'figurinha de link para a página', 'contagem regressiva', 'teste (quiz) com 3 opções'] },
      ...comImagens(c, (n) => [`${n} no centro da tela`]),
      { nome: 'Texto', frases: ['texto no terço de cima (longe dos botões)', 'frase curta, no máximo 2 linhas', 'fundo com as cores da marca'] },
    ],
    exemplo: (c) => `Foto de bastidor no fundo com ${c.pessoas[0] ?? 'a pessoa da marca'} sorrindo; texto curto no terço de cima, no máximo 2 linhas; figurinha de enquete com 2 opções no centro.`,
  },
  capa: {
    checklist: 'rosto e expressão · poucas palavras grandes · contraste forte · o que aparece além do texto',
    grupos: (c) => [
      ...comPessoas(c, (p) => [`${p} em close, olhando para a câmera`, `${p} com expressão de surpresa`, `${p} apontando para o título`]),
      { nome: 'Texto da capa', frases: ['até 4 palavras grandes', 'contraste forte com o fundo', 'palavra principal em dourado', 'texto à esquerda e rosto à direita'] },
      ...comImagens(c, (n) => [`${n} pequeno no canto`, `${n} ao lado do rosto`]),
      { nome: 'Fundo', frases: CENARIO },
    ],
    exemplo: (c) => `${pessoa(c)} em close à direita, olhando para a câmera, expressão de surpresa; fundo escuro liso; título com até 4 palavras grandes à esquerda, palavra principal em dourado; ${imagem(c)} pequeno no canto.`,
  },
  gravacao: {
    checklist: 'onde gravar · enquadramento · luz e som · roupa · como editar · cuidados com o conselho',
    grupos: (c) => [
      { nome: 'Enquadramento', frases: [c.tipo === 'video' ? 'horizontal 16:9, câmera no tripé' : 'vertical 9:16, celular na altura dos olhos', 'plano médio (da cintura para cima)', 'close no rosto no gancho'] },
      { nome: 'Ambiente, luz e som', frases: LUZ_GRAVACAO },
      ...(c.pessoas.length ? [{ nome: 'Roupa', frases: ROUPA }] : []),
      { nome: 'Edição', frases: ['cortes a cada 2 a 3 segundos', 'legenda na tela em todas as falas', 'texto do gancho na tela no 1º segundo', 'música baixa de fundo', 'zoom no momento principal'] },
      { nome: 'Cuidados', frases: CUIDADOS },
    ],
    exemplo: (c) => `${c.tipo === 'video' ? 'Horizontal 16:9, câmera no tripé' : 'Vertical 9:16, celular na altura dos olhos'}; plano médio no consultório arrumado; luz natural de frente; roupa: jaleco branco; cortes a cada 2 a 3 segundos e legenda na tela em todas as falas; sem promessa de resultado.`,
  },
  transmissao: {
    checklist: 'o que preparar antes · como conduzir · cenário e luz · quando chamar para a oferta',
    grupos: () => [
      { nome: 'Antes', frases: ['testar internet e áudio 15 minutos antes', 'avisar nos stories 1 dia e 1 hora antes', 'deixar o link da oferta pronto para fixar'] },
      { nome: 'Durante', frases: ['cumprimentar quem chega pelo nome', 'responder perguntas ao fim de cada bloco', 'repetir a chamada no meio e no fim', 'fixar o comentário com o link'] },
      { nome: 'Cenário e luz', frases: LUZ_GRAVACAO },
      { nome: 'Cuidados', frases: CUIDADOS },
    ],
    exemplo: () => 'Testar internet e áudio 15 minutos antes; avisar nos stories 1 dia e 1 hora antes; luz natural de frente, consultório arrumado ao fundo; cumprimentar quem chega pelo nome; repetir a chamada no meio e no fim e fixar o comentário com o link.',
  },
  cena: {
    checklist: 'o que aparece na tela · como é a fala · o texto na tela · o corte para a próxima cena',
    grupos: (c) => [
      { nome: 'Na tela', frases: ['close no rosto falando para a câmera', 'mostrando o produto na mão', 'detalhe (close) do procedimento, com autorização', 'imagem de apoio enquanto fala'] },
      ...comPessoas(c, (p) => [`${p} falando para a câmera`]),
      { nome: 'Texto na tela', frases: ['texto do gancho em letras grandes', 'legenda da fala', 'número ou dado em destaque'] },
      { nome: 'Edição', frases: ['corte rápido para a próxima cena', 'zoom no momento principal', 'pausa antes da revelação'] },
    ],
    exemplo: () => 'Close no rosto falando para a câmera; texto do gancho em letras grandes na tela; corte rápido para o produto na mão.',
  },
  bloco: {
    checklist: 'o que a câmera mostra · imagem de apoio · texto na tela · como fecha o bloco',
    grupos: () => [
      { nome: 'Câmera', frases: ['plano médio falando para a câmera', 'tela com slide ou exemplo', 'imagens de apoio enquanto explica'] },
      { nome: 'Edição', frases: ['título do bloco na tela', 'zoom para dar ênfase', 'gráfico ou lista na tela'] },
      { nome: 'Fechamento', frases: ['resumo em uma frase no fim do bloco', 'gancho para o próximo bloco', 'chamada para comentar'] },
    ],
    exemplo: () => 'Plano médio falando para a câmera; título do bloco na tela; imagens de apoio enquanto explica; fechar com um resumo em uma frase e o gancho para o próximo bloco.',
  },
  pauta: {
    checklist: 'quanto tempo · como puxar o público · quando falar da oferta',
    grupos: () => [
      { nome: 'Interação', frases: ['pedir para o público comentar uma palavra', 'ler 2 comentários em voz alta', 'fazer uma pergunta e esperar respostas'] },
      { nome: 'Ritmo', frases: ['até 5 minutos neste bloco', 'contar um caso real (com autorização)', 'chamada para a oferta no fim do bloco'] },
    ],
    exemplo: () => 'Até 5 minutos neste bloco; começar pedindo para o público comentar uma palavra; ler 2 comentários em voz alta; fechar com a chamada para a oferta.',
  },
  pagina: {
    checklist: 'hierarquia (título, texto, destaque) · imagens · respiro · o que a pessoa deve guardar desta página',
    grupos: (c) => [
      { nome: 'Diagramação', frases: ['título grande no topo', 'uma ideia por página', 'lista com ícones', 'destaque em caixa colorida', 'bastante margem e respiro'] },
      ...comImagens(c, (n) => [`${n} à direita do texto`, `${n} no rodapé`]),
      { nome: 'Fechamento', frases: ['frase de destaque no fim da página', 'chamada para a próxima página'] },
    ],
    exemplo: () => 'Título grande no topo; uma ideia por página; lista com ícones; frase de destaque em caixa colorida no fim; bastante margem e respiro.',
  },
  diagramacao: {
    checklist: 'tamanho e orientação · capa · fontes e cores · numeração · última página',
    grupos: () => [
      { nome: 'Formato', frases: ['A4 vertical', 'capa com foto e título grande', 'fontes e cores da marca', 'numerar as páginas'] },
      { nome: 'Leitura', frases: ['no máximo 3 parágrafos por página', 'destaques em caixa colorida', 'ícones nas listas'] },
      { nome: 'Fechamento', frases: ['última página com chamada e contato', 'logo no rodapé de todas as páginas'] },
    ],
    exemplo: () => 'A4 vertical; capa com foto e título grande; fontes e cores da marca; no máximo 3 parágrafos por página com destaques em caixa colorida; páginas numeradas; última página com chamada e contato.',
  },
  secao: {
    checklist: 'como começa · exemplo prático · formato (lista, passo a passo) · como liga à próxima seção',
    grupos: () => [
      { nome: 'Texto', frases: ['começar com uma pergunta', 'usar um exemplo prático', 'lista com 3 a 5 itens', 'passo a passo numerado', 'terminar levando à próxima seção'] },
      { nome: 'Tom', frases: ['linguagem simples, sem jargão', 'falar direto com o leitor (você)'] },
    ],
    exemplo: () => 'Começar com uma pergunta; explicar com um exemplo prático; lista com 3 a 5 itens; linguagem simples; terminar levando à próxima seção.',
  },
}

export const guiaDe = (uso: Uso) => GUIAS[uso]

// qual guia usar em cada campo de orientação
const COM_ARTE = ['post', 'carrossel', 'stories', 'texto']
export function usoDoCampo(tipo: string, campo: string): Uso | null {
  if (campo === 'prompt_imagem') return COM_ARTE.includes(tipo) ? (tipo === 'stories' ? 'tela' : 'arte') : 'capa'
  if (campo === 'observacao') return ({ reels: 'gravacao', video: 'gravacao', stories: 'gravacao', live: 'transmissao', pdf: 'diagramacao' } as Record<string, Uso>)[tipo] ?? null
  return null
}
export const usoDoItem = (tipo: string): Uso | null =>
  ({ carrossel: 'arte', stories: 'tela', reels: 'cena', video: 'bloco', live: 'pauta', pdf: 'pagina', artigo: 'secao' } as Record<string, Uso>)[tipo] ?? null

// sugestões rápidas para "Pedir ajuste à IA", por formato
const AJUSTE_COMUM = ['mais curto e direto', 'tom mais próximo, de conversa', 'chamada para ação mais clara']
const AJUSTE: Record<string, string[]> = {
  post: ['texto da arte mais curto', 'termine a legenda com uma pergunta'],
  carrossel: ['capa com uma promessa mais clara', 'uma ideia por lâmina', 'última lâmina com a chamada'],
  reels: ['gancho mais forte nos 3 primeiros segundos', 'falas mais curtas para caber no tempo', 'mais uma cena mostrando o resultado'],
  stories: ['mais interação (enquete ou caixinha)', 'menos texto por tela', 'última tela com link'],
  video: ['título mais buscável', 'capítulos na descrição', 'abertura mais curta'],
  live: ['mais perguntas para o público', 'chamada para a oferta no meio e no fim'],
  texto: ['opções de enquete mais provocativas', 'termine com uma pergunta'],
  artigo: ['intertítulos mais claros', 'mais exemplos práticos', 'parágrafos mais curtos'],
  email: ['assunto mais curioso', 'um parágrafo a menos', 'um botão só'],
  mensagem: ['mais pessoal, menos cara de disparo', 'chamar pelo nome com {nome}', 'terminar com uma pergunta'],
  pdf: ['menos texto por página', 'mais listas e destaques'],
}
export const sugestoesAjuste = (tipo: string) => [...(AJUSTE[tipo] ?? []), ...AJUSTE_COMUM]
