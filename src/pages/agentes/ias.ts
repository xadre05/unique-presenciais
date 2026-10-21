// As inteligências artificiais que os agentes podem usar, o que cada uma faz e qual faz cada trabalho.
// A chave de cada uma fica cifrada no servidor, por empresa (tabela agentes_chaves + Vault).
// "Automático": o sistema escolhe a melhor IA com chave cadastrada para o trabalho.
export type Provedor = 'anthropic' | 'openai' | 'google' | 'xai' | 'elevenlabs' | 'higgsfield'
export type Trabalho = 'texto' | 'imagem'
export type Escolha = { provedor: Provedor | 'auto'; modelo?: string }
export type EscolhaIAs = Partial<Record<Trabalho, Escolha>>
export type ChaveCadastrada = { provedor: Provedor; final: string | null; cadastrada_em: string }

type Modelo = { id: string; nome: string; trabalho: Trabalho; pronto: boolean; dica: string }
export type InfoProvedor = { nome: string; empresa: string; faz: string; prefixo: string; site: string; passos: string[]; modelos: Modelo[] }

export const PROVEDORES: Record<Provedor, InfoProvedor> = {
  anthropic: {
    nome: 'Claude', empresa: 'Anthropic', faz: 'Texto: posts, roteiros, legendas, planejamento e conversa', prefixo: 'sk-ant-', site: 'console.anthropic.com',
    passos: ['Entre em console.anthropic.com com o seu login (é diferente da assinatura do app do Claude).', 'Em Billing, coloque crédito (pré-pago, cobrado por uso). US$ 5 a 10 rendem semanas de conteúdo.', 'Em API Keys → Create Key, dê o nome "Unique" e copie a chave (começa com sk-ant-).'],
    modelos: [{ id: 'claude', nome: 'Claude', trabalho: 'texto', pronto: true, dica: 'Melhor escrita em português e segue bem as regras da marca.' }],
  },
  openai: {
    nome: 'ChatGPT', empresa: 'OpenAI', faz: 'Imagem: artes com pessoas reais (a partir de fotos) e com texto na arte', prefixo: 'sk-', site: 'platform.openai.com',
    passos: ['Entre em platform.openai.com com o seu login (é diferente da assinatura do ChatGPT).', 'Em Settings → Billing, coloque crédito (pré-pago). US$ 10 dão para começar.', 'Em API keys → Create new secret key, dê o nome "Unique" e copie a chave (começa com sk-). Ela só aparece uma vez.', 'A OpenAI pode pedir para verificar a organização (documento) antes de liberar a geração de imagem.'],
    modelos: [
      { id: 'gpt-image', nome: 'GPT Image', trabalho: 'imagem', pronto: false, dica: 'Põe pessoas reais a partir de fotos e escreve bem o texto na arte.' },
      { id: 'gpt', nome: 'GPT', trabalho: 'texto', pronto: false, dica: 'Alternativa para texto.' },
    ],
  },
  google: {
    nome: 'Gemini', empresa: 'Google', faz: 'Imagem: fotos realistas sem pessoas (consultório, produto, ambiente)', prefixo: 'AIza', site: 'aistudio.google.com',
    passos: ['Entre em aistudio.google.com com uma conta Google da empresa.', 'Clique em Get API key → Create API key e copie (começa com AIza).', 'Para gerar imagem, ative o faturamento no projeto do Google Cloud ligado à chave.'],
    modelos: [
      { id: 'nano-banana', nome: 'Gemini Imagem (Nano Banana)', trabalho: 'imagem', pronto: false, dica: 'Fotos muito realistas. Não reproduz o rosto de pessoas reais.' },
      { id: 'gemini', nome: 'Gemini', trabalho: 'texto', pronto: false, dica: 'Alternativa para texto.' },
    ],
  },
  xai: {
    nome: 'Grok', empresa: 'xAI', faz: 'Imagem: retratos com pele natural; alternativa de texto', prefixo: 'xai-', site: 'console.x.ai',
    passos: ['Entre em console.x.ai.', 'Coloque crédito em Billing.', 'Em API Keys → Create API Key, copie a chave (começa com xai-).'],
    modelos: [{ id: 'grok-imagine', nome: 'Grok Imagine', trabalho: 'imagem', pronto: false, dica: 'Retratos com textura de pele natural.' }],
  },
  // Agente Editor de Vídeo: narração com voz de IA (vídeo sem gravar) e cenas reais geradas (b-roll)
  elevenlabs: {
    nome: 'ElevenLabs', empresa: 'ElevenLabs', faz: 'Voz: narração com voz de IA para vídeos sem gravar', prefixo: 'sk_', site: 'elevenlabs.io',
    passos: ['Entre em elevenlabs.io e escolha um plano pago (a narração é cobrada por caractere).', 'Em Developers → API Keys, crie uma chave com o nome "Unique" e copie (começa com sk_).', 'Opcional: em Voices, clone a voz de quem é o rosto da marca, com autorização dela.'],
    modelos: [],
  },
  higgsfield: {
    nome: 'Higgsfield', empresa: 'Higgsfield', faz: 'Vídeo: imagens e clipes realistas (b-roll) gerados para cobrir a fala', prefixo: '', site: 'open.higgsfield.ai',
    passos: ['Entre em open.higgsfield.ai e coloque saldo (cobrado por imagem e por segundo de vídeo; um clipe de 5 s custa cerca de US$ 0,20).', 'Em API Keys, crie uma chave: ela tem duas partes, KEY ID e KEY SECRET.', 'Cole aqui no formato KEY_ID:KEY_SECRET (as duas partes separadas por dois-pontos).'],
    modelos: [],
  },
}
export const ORDEM: Provedor[] = ['anthropic', 'openai', 'google', 'xai', 'elevenlabs', 'higgsfield']

// padrão: Claude escreve, GPT Image faz a arte; "automático" cai nessa ordem conforme as chaves cadastradas
export const PADRAO: Record<Trabalho, Provedor[]> = { texto: ['anthropic', 'openai', 'google'], imagem: ['openai', 'google', 'xai'] }
export const NOME_TRABALHO: Record<Trabalho, string> = { texto: 'Texto (posts, roteiros, legendas)', imagem: 'Imagem (artes, capas, fotos)' }

export const modelosDe = (t: Trabalho) => ORDEM.flatMap((p) => PROVEDORES[p].modelos.filter((m) => m.trabalho === t).map((m) => ({ ...m, provedor: p })))

// qual IA vai fazer o trabalho de fato (escolhida ou a melhor com chave)
export function quemFaz(t: Trabalho, escolha: Escolha | undefined, chaves: Provedor[]) {
  if (escolha && escolha.provedor !== 'auto' && chaves.includes(escolha.provedor)) return escolha.provedor
  return PADRAO[t].find((p) => chaves.includes(p)) ?? null
}
