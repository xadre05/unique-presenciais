// Formatos de peça: o que é cada um, o que o agente prepara e como o editor chama cada campo.
// Canal, formato e finalidade são coisas separadas: o canal diz ONDE sai (redes.ts), o formato diz O QUE é
// (este arquivo) e a finalidade (objetivo do briefing) diz PARA QUE serve.
// Os campos da peça são os mesmos para todo formato (titulo, legenda, roteiro, texto_arte, prompt_imagem,
// observacao); muda só o nome que aparece no editor. A função do agente usa o mesmo mapa (GUIA_FORMATO).
export type Formato = 'post' | 'carrossel' | 'reels' | 'stories' | 'video' | 'live' | 'texto' | 'artigo' | 'email' | 'mensagem' | 'pdf'

type Campos = {
  titulo: string; legenda: string; secaoLegenda: string; hashtags: boolean
  roteiro: [string, string]; secaoRoteiro: string; arte: string; secaoVisual: string
}
export type InfoFormato = { nome: string; icone: string; cor: string; prepara: string; material: 'Texto' | 'Roteiro' | 'Conteúdo'; campos: Campos }

const BASE: Campos = { titulo: 'Título', legenda: 'Legenda', secaoLegenda: 'Legenda, chamada e hashtags', hashtags: true, roteiro: ['Texto da arte', 'Linha'], secaoRoteiro: 'Texto da arte', arte: 'Texto que vai na arte', secaoVisual: 'Direção visual' }
const VIDEO: Campos = { ...BASE, roteiro: ['Cenas', 'Cena'], secaoRoteiro: 'Roteiro', arte: 'Texto da capa', secaoVisual: 'Orientações de gravação e capa' }

export const FORMATO: Record<Formato, InfoFormato> = {
  post: { nome: 'Imagem', icone: 'imagem', cor: '#d9a24b', material: 'Texto', prepara: 'Texto da arte, legenda e pedido da imagem', campos: BASE },
  carrossel: { nome: 'Carrossel', icone: 'quadro', cor: '#a46ee6', material: 'Texto', prepara: 'Texto de cada lâmina, legenda e direção visual', campos: { ...BASE, roteiro: ['Lâminas', 'Lâmina'], secaoRoteiro: 'Lâminas' } },
  reels: { nome: 'Vídeo curto', icone: 'claquete', cor: '#e5534b', material: 'Roteiro', prepara: 'Roteiro cena a cena, legenda e capa', campos: VIDEO },
  stories: { nome: 'Stories', icone: 'celular', cor: '#2fb3a0', material: 'Roteiro', prepara: 'Texto de cada tela e interações', campos: { ...BASE, roteiro: ['Telas', 'Tela'], secaoRoteiro: 'Telas', arte: 'Texto em destaque' } },
  video: { nome: 'Vídeo longo', icone: 'video', cor: '#e07b39', material: 'Roteiro', prepara: 'Roteiro em blocos, título, descrição e thumbnail', campos: { ...VIDEO, titulo: 'Título proposto', legenda: 'Descrição', secaoLegenda: 'Descrição, chamada e hashtags', roteiro: ['Blocos do roteiro', 'Bloco'], arte: 'Texto da thumbnail' } },
  live: { nome: 'Live', icone: 'live', cor: '#ff5d8f', material: 'Roteiro', prepara: 'Pauta, roteiro, perguntas e chamada', campos: { ...VIDEO, titulo: 'Tema da live', legenda: 'Texto de divulgação', secaoLegenda: 'Divulgação, chamada e hashtags', roteiro: ['Pauta', 'Bloco'], secaoRoteiro: 'Pauta, roteiro e perguntas', arte: 'Texto da capa da live', secaoVisual: 'Capa e orientações da transmissão' } },
  texto: { nome: 'Texto / enquete', icone: 'texto', cor: '#8fb3ff', material: 'Texto', prepara: 'Texto, pergunta e opções de resposta', campos: { ...BASE, legenda: 'Texto da publicação', secaoLegenda: 'Texto da publicação', roteiro: ['Opções da enquete', 'Opção'], secaoRoteiro: 'Enquete (opcional)', arte: 'Texto da imagem (opcional)', secaoVisual: 'Imagem (opcional)' } },
  artigo: { nome: 'Artigo', icone: 'documento', cor: '#5ac8fa', material: 'Texto', prepara: 'Estrutura, conteúdo e sugestão de capa', campos: { ...BASE, titulo: 'Título do artigo', legenda: 'Artigo completo', secaoLegenda: 'Artigo', hashtags: false, roteiro: ['Seções', 'Seção'], secaoRoteiro: 'Estrutura (intertítulos)', arte: 'Texto da capa', secaoVisual: 'Capa' } },
  email: { nome: 'E-mail', icone: 'email', cor: '#c18cff', material: 'Texto', prepara: 'Assunto, prévia, corpo e chamada', campos: { ...BASE, titulo: 'Assunto', legenda: 'Corpo do e-mail', secaoLegenda: 'Corpo e chamada', hashtags: false, roteiro: ['Outros assuntos para testar', 'Assunto'], secaoRoteiro: 'Variações de assunto', arte: 'Prévia (aparece ao lado do assunto)', secaoVisual: 'Prévia e imagem' } },
  mensagem: { nome: 'Mensagem', icone: 'mensagem', cor: '#25d366', material: 'Texto', prepara: 'Mensagem e variações', campos: { ...BASE, legenda: 'Mensagem', secaoLegenda: 'Mensagem e chamada', hashtags: false, roteiro: ['Variações', 'Variação'], secaoRoteiro: 'Variações da mensagem', arte: 'Texto da imagem (opcional)', secaoVisual: 'Imagem (opcional)' } },
  pdf: { nome: 'Material PDF', icone: 'pdf', cor: '#ff7a59', material: 'Conteúdo', prepara: 'Conteúdo página a página e orientação de diagramação', campos: { ...BASE, titulo: 'Título do material', legenda: 'Texto de apresentação', secaoLegenda: 'Apresentação e chamada', hashtags: false, roteiro: ['Páginas', 'Página'], secaoRoteiro: 'Conteúdo por página', arte: 'Texto da capa', secaoVisual: 'Capa e diagramação' } },
}
export const FORMATOS = Object.keys(FORMATO) as Formato[]
export const infoFormato = (tipo: string): InfoFormato => FORMATO[tipo as Formato] ?? FORMATO.post

// duração desejada (regra 3)
export const DURACOES: Partial<Record<Formato, string[]>> = {
  reels: ['15 segundos', '30 segundos', '60 segundos', '90 segundos'],
  video: ['3 a 5 minutos', '6 a 10 minutos', '10 a 15 minutos', '15 a 25 minutos'],
  live: ['30 minutos', '45 minutos', '1 hora', '1 hora e meia'],
}
export const ehVideo = (f: string) => f === 'reels' || f === 'video' || f === 'live'
