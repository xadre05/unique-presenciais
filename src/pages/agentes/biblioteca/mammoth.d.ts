// leitor de Word no navegador (sem tipos publicados): só a função usada aqui
declare module 'mammoth/mammoth.browser.min.js' {
  export function extractRawText(entrada: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
  const mammoth: { extractRawText: typeof extractRawText }
  export default mammoth
}
