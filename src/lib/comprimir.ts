// Fotos grandes (celular, câmera) passam do limite do armazenamento. Antes de enviar, a imagem é reduzida
// no navegador: lado maior até 2048 px. PNG continua PNG (mantém o fundo transparente dos logos);
// o resto vira JPEG de boa qualidade. Imagem já pequena vai como está.
const LADO_MAXIMO = 2048
const TAMANHO_OK = 1.5 * 1024 * 1024

function carregar(arquivo: File) {
  return new Promise<HTMLImageElement>((ok, falha) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir a imagem.')) }
    img.src = url
  })
}

export async function comprimirImagem(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo
  const img = await carregar(arquivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
  if (escala === 1 && arquivo.size <= TAMANHO_OK) return arquivo
  const tela = document.createElement('canvas')
  tela.width = Math.round(img.naturalWidth * escala)
  tela.height = Math.round(img.naturalHeight * escala)
  tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height)
  const png = arquivo.type === 'image/png'
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, png ? 'image/png' : 'image/jpeg', 0.88))
  if (!blob || blob.size >= arquivo.size) return arquivo
  const nome = png ? arquivo.name : arquivo.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nome, { type: blob.type })
}
