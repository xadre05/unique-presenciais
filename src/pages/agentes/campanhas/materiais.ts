// Materiais de uma campanha (página de vendas, roteiros, copy): nomes dos papéis e o limite que o agente lê de cada um.
// O agente lê o texto inteiro deles (até o limite) sempre que cria ou ajusta algo da campanha (functions/agentes).
export type Papel = 'pagina' | 'roteiro' | 'copy' | 'apresentacao' | 'outro'
export const PAPEIS: [Papel, string][] = [['pagina', 'Página de vendas'], ['roteiro', 'Roteiro de vídeo'], ['copy', 'Copy / textos'], ['apresentacao', 'Apresentação'], ['outro', 'Outro']]
export const NOME_PAPEL = Object.fromEntries(PAPEIS) as Record<Papel, string>
export const LIMITE_MATERIAL = 12000
