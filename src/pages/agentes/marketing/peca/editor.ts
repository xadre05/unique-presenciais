// Como o detalhe da peça se monta em cada formato: abas, campos de cada aba, nome e limite dos itens
// (lâmina, cena, tela, página…), o que é a etapa do meio (arte, gravação, capa, diagramação) e a proporção padrão.
// Os dados ficam sempre nos mesmos campos da peça (titulo, legenda, roteiro, texto_arte…); muda só a tela.
import { infoFormato, type Formato } from '../formatos'

export type CampoTexto = 'titulo' | 'legenda' | 'cta' | 'hashtags' | 'texto_arte' | 'prompt_imagem' | 'observacao' | 'apoio'
export type Campo = { campo: CampoTexto; rotulo: string; max?: number; linhas?: number; dica?: string }
export type AbaId = 'itens' | 'principal' | 'legenda' | 'visual' | 'edicao' | 'versoes'
export type Aba = { id: AbaId; nome: string; icone: string }
export type ConfigItem = { titulo: string | null; texto: string | null; maxTitulo?: number; maxTexto?: number; capa?: boolean }
export type Etapa2 = { nome: string; pendente: string; feita: string; acao: string; arquivos: boolean }
export type ConfigEditor = {
  abas: Aba[]; item: ConfigItem; principal: Campo[]; legenda: Campo[]; visual: Campo[]
  artes: 'por_item' | 'unica' | null; etapa2: Etapa2 | null; proporcao: string; rotuloArte: string
}

const VERSOES: Aba = { id: 'versoes', nome: 'Versões', icone: 'historico' }
// o vídeo gravado: publicar como veio ou editar com o Agente Editor de Vídeo (monta no navegador; nada fica no banco)
const EDICAO: Aba = { id: 'edicao', nome: 'Vídeo', icone: 'video' }
const aba = (id: AbaId, nome: string, icone: string): Aba => ({ id, nome, icone })
const LEGENDA: Campo[] = [{ campo: 'legenda', rotulo: 'Legenda', linhas: 9 }, { campo: 'cta', rotulo: 'Chamada para ação', max: 150 }, { campo: 'hashtags', rotulo: 'Hashtags' }]
const ORIENTA_ARTE: Campo = { campo: 'prompt_imagem', rotulo: 'Orientação para a arte', linhas: 5, dica: 'Cena, enquadramento, luz e o texto que vai na arte. Serve para gerar a arte aqui ou para colar em outra IA.' }
const GRAVACAO: Campo = { campo: 'observacao', rotulo: 'Orientações de gravação', linhas: 4, dica: 'Onde gravar, enquadramento, luz, roupa e cuidados com as regras do conselho.' }
const capa = (rotulo: string): Campo[] => [{ campo: 'texto_arte', rotulo: `Texto da ${rotulo.toLowerCase()}`, max: 60 }, { campo: 'prompt_imagem', rotulo: `Orientação para a ${rotulo.toLowerCase()}`, linhas: 4 }]
const ARTE: Etapa2 = { nome: 'Arte', pendente: 'Arte pendente', feita: 'Arte pronta', acao: 'Aprovar arte', arquivos: true }
const GRAVAR: Etapa2 = { nome: 'Gravação e edição', pendente: 'Gravação pendente', feita: 'Vídeo editado', acao: 'Concluir gravação', arquivos: false }
const SEM_ITEM: ConfigItem = { titulo: null, texto: null }

const CONFIG: Record<Formato, ConfigEditor> = {
  post: {
    abas: [aba('principal', 'Texto da arte', 'imagem'), aba('legenda', 'Legenda', 'documento'), aba('visual', 'Direção visual', 'olho'), VERSOES], item: SEM_ITEM,
    principal: [{ campo: 'texto_arte', rotulo: 'Título da arte', max: 100 }, { campo: 'apoio', rotulo: 'Texto de apoio', max: 300, linhas: 4 }],
    legenda: LEGENDA, visual: [ORIENTA_ARTE, { campo: 'observacao', rotulo: 'Observações', linhas: 3 }], artes: 'unica', etapa2: ARTE, proporcao: '4:5', rotuloArte: 'Arte',
  },
  carrossel: {
    abas: [aba('itens', 'Lâminas', 'quadro'), aba('legenda', 'Legenda', 'documento'), aba('visual', 'Direção visual', 'olho'), VERSOES],
    item: { titulo: 'Título da lâmina', texto: 'Texto de apoio', maxTitulo: 100, maxTexto: 300, capa: true },
    principal: [], legenda: LEGENDA, visual: [ORIENTA_ARTE, { campo: 'observacao', rotulo: 'Observações', linhas: 3 }], artes: 'por_item', etapa2: ARTE, proporcao: '4:5', rotuloArte: 'Arte',
  },
  reels: {
    abas: [aba('itens', 'Roteiro', 'claquete'), aba('legenda', 'Legenda', 'documento'), aba('visual', 'Gravação e capa', 'video'), EDICAO, VERSOES],
    item: { titulo: 'Cena (tempo ou nome)', texto: 'Fala e o que aparece na tela', maxTitulo: 60, maxTexto: 600 },
    principal: [], legenda: LEGENDA, visual: [GRAVACAO, ...capa('Capa')], artes: 'unica', etapa2: GRAVAR, proporcao: '9:16', rotuloArte: 'Capa',
  },
  video: {
    abas: [aba('itens', 'Roteiro', 'claquete'), aba('legenda', 'Título e descrição', 'documento'), aba('visual', 'Gravação e thumbnail', 'video'), EDICAO, VERSOES],
    item: { titulo: 'Bloco (tempo e tema)', texto: 'Conteúdo do bloco', maxTitulo: 80, maxTexto: 1500 },
    principal: [], legenda: [{ campo: 'titulo', rotulo: 'Título do vídeo', max: 100 }, { campo: 'legenda', rotulo: 'Descrição', linhas: 10, max: 5000 }, { campo: 'cta', rotulo: 'Chamada para ação', max: 150 }, { campo: 'hashtags', rotulo: 'Hashtags' }],
    visual: [GRAVACAO, ...capa('Thumbnail')], artes: 'unica', etapa2: GRAVAR, proporcao: '16:9', rotuloArte: 'Thumbnail',
  },
  live: {
    abas: [aba('itens', 'Pauta', 'lista'), aba('legenda', 'Divulgação', 'documento'), aba('visual', 'Transmissão e capa', 'live'), VERSOES],
    item: { titulo: 'Bloco da pauta', texto: 'O que falar e perguntas para o público', maxTitulo: 80, maxTexto: 1000 },
    principal: [], legenda: [{ campo: 'titulo', rotulo: 'Tema da live', max: 100 }, { campo: 'legenda', rotulo: 'Texto de divulgação', linhas: 7 }, { campo: 'cta', rotulo: 'Chamada para ação', max: 150 }, { campo: 'hashtags', rotulo: 'Hashtags' }],
    visual: [{ ...GRAVACAO, rotulo: 'Orientações da transmissão' }, ...capa('Capa')], artes: 'unica',
    etapa2: { nome: 'Capa e divulgação', pendente: 'Capa pendente', feita: 'Capa pronta', acao: 'Aprovar capa', arquivos: true }, proporcao: '9:16', rotuloArte: 'Capa',
  },
  stories: {
    abas: [aba('itens', 'Telas', 'celular'), aba('visual', 'Direção visual', 'olho'), VERSOES],
    item: { titulo: 'Texto em destaque', texto: 'Texto de apoio e interação', maxTitulo: 80, maxTexto: 250 },
    principal: [], legenda: [], visual: [ORIENTA_ARTE, { ...GRAVACAO, rotulo: 'Orientações de gravação (se tiver vídeo)', linhas: 3 }], artes: 'por_item', etapa2: ARTE, proporcao: '9:16', rotuloArte: 'Arte',
  },
  texto: {
    abas: [aba('principal', 'Texto', 'texto'), aba('itens', 'Enquete', 'lista'), aba('visual', 'Imagem (opcional)', 'imagem'), VERSOES],
    item: { titulo: 'Opção de resposta', texto: null, maxTitulo: 30 },
    principal: [{ campo: 'legenda', rotulo: 'Texto da publicação', linhas: 8 }, { campo: 'cta', rotulo: 'Chamada para ação', max: 150 }],
    legenda: [], visual: [{ campo: 'texto_arte', rotulo: 'Texto da imagem', max: 80 }, { ...ORIENTA_ARTE, rotulo: 'Orientação para a imagem' }], artes: 'unica', etapa2: null, proporcao: '1:1', rotuloArte: 'Imagem',
  },
  artigo: {
    abas: [aba('principal', 'Artigo', 'documento'), aba('itens', 'Estrutura', 'lista'), aba('visual', 'Capa', 'imagem'), VERSOES],
    item: { titulo: 'Intertítulo', texto: 'Resumo da seção', maxTitulo: 100, maxTexto: 400 },
    principal: [{ campo: 'titulo', rotulo: 'Título do artigo', max: 120 }, { campo: 'legenda', rotulo: 'Artigo completo', linhas: 18 }, { campo: 'cta', rotulo: 'Chamada para ação', max: 150 }],
    legenda: [], visual: capa('Capa'), artes: 'unica', etapa2: { nome: 'Capa', pendente: 'Capa pendente', feita: 'Capa pronta', acao: 'Aprovar capa', arquivos: true }, proporcao: '16:9', rotuloArte: 'Capa',
  },
  email: {
    abas: [aba('principal', 'E-mail', 'email'), aba('itens', 'Variações de assunto', 'lista'), VERSOES],
    item: { titulo: 'Assunto alternativo', texto: null, maxTitulo: 50 },
    principal: [{ campo: 'titulo', rotulo: 'Assunto', max: 50 }, { campo: 'texto_arte', rotulo: 'Prévia', max: 90, dica: 'Aparece ao lado do assunto na caixa de entrada.' }, { campo: 'legenda', rotulo: 'Corpo do e-mail', linhas: 12 }, { campo: 'cta', rotulo: 'Texto do botão', max: 40 }],
    legenda: [], visual: [], artes: null, etapa2: null, proporcao: '—', rotuloArte: '',
  },
  mensagem: {
    abas: [aba('principal', 'Mensagem', 'mensagem'), aba('itens', 'Variações', 'lista'), VERSOES],
    item: { titulo: null, texto: 'Variação da mensagem', maxTexto: 1000 },
    principal: [{ campo: 'legenda', rotulo: 'Mensagem', linhas: 8, max: 1000 }, { campo: 'cta', rotulo: 'Ação esperada', max: 150 }],
    legenda: [], visual: [], artes: null, etapa2: null, proporcao: '—', rotuloArte: '',
  },
  pdf: {
    abas: [aba('itens', 'Páginas', 'pdf'), aba('legenda', 'Apresentação', 'documento'), aba('visual', 'Diagramação', 'olho'), VERSOES],
    item: { titulo: 'Título da página', texto: 'Conteúdo da página', maxTitulo: 100, maxTexto: 1500, capa: true },
    principal: [], legenda: [{ campo: 'titulo', rotulo: 'Título do material', max: 120 }, { campo: 'legenda', rotulo: 'Texto de apresentação', linhas: 6 }, { campo: 'cta', rotulo: 'Chamada para ação', max: 150 }],
    visual: [{ campo: 'observacao', rotulo: 'Orientação de diagramação', linhas: 4 }, ...capa('Capa')], artes: 'unica',
    etapa2: { nome: 'Diagramação', pendente: 'Diagramação pendente', feita: 'PDF pronto', acao: 'Aprovar PDF', arquivos: true }, proporcao: 'A4', rotuloArte: 'PDF diagramado',
  },
}

export const configDe = (tipo: string): ConfigEditor => CONFIG[tipo as Formato] ?? CONFIG.post

// Vídeo avulso (criado em Agente Editor → "Editar um vídeo"): não tem roteiro nem gravação planejados. Começa na
// edição do vídeo, depois a legenda e a aprovação. Sem a etapa de texto (ver progresso.ts).
const EDITAR: Etapa2 = { nome: 'Edição do vídeo', pendente: 'Edição pendente', feita: 'Vídeo editado', acao: 'Concluir edição', arquivos: false }
const AVULSO: ConfigEditor = { ...CONFIG.reels, abas: [{ id: 'edicao', nome: 'Edição do vídeo', icone: 'video' }, aba('legenda', 'Legenda', 'documento'), VERSOES], visual: [], artes: null, etapa2: EDITAR }
type PecaMinima = { tipo: string; conteudo: unknown }
export const ehAvulso = (p: PecaMinima) => (p.conteudo as { origem?: unknown } | null)?.origem === 'editor'
export const configDaPeca = (p: PecaMinima): ConfigEditor => (ehAvulso(p) ? { ...AVULSO, proporcao: p.tipo === 'video' ? '16:9' : '9:16' } : configDe(p.tipo))
// nome do item no singular e no plural (lâmina/lâminas, cena/cenas…), vindo de formatos.ts
export function nomesItem(tipo: string) {
  const [plural, singular] = infoFormato(tipo).campos.roteiro
  return { plural, singular }
}

// limite de caracteres da legenda em cada canal
const LIMITE_LEGENDA: Record<string, number> = { instagram: 2200, tiktok: 4000, youtube: 5000, facebook: 5000, linkedin: 3000, pinterest: 500, threads: 500, whatsapp: 1000 }
export const limiteLegenda = (rede: string) => LIMITE_LEGENDA[rede]

export const PROPORCOES = ['4:5', '1:1', '9:16', '16:9', '2:3', 'A4']
export const ESTILOS = ['Editorial premium', 'Minimalista', 'Fotográfico', 'Tipográfico', 'Ilustração', 'Clínico e limpo']
