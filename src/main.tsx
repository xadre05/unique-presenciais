import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// app instalável (celular/computador) e avisos que abrem a conversa
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })

// faixa "VERSÃO DE TESTE" em qualquer endereço que não seja o do sistema oficial
if (!['unique-presenciais.vercel.app'].includes(window.location.hostname) && !window.location.pathname.startsWith('/f/')) {
  const f = document.createElement('div')
  f.className = 'faixa-teste'
  f.textContent = window.location.hostname.includes('localhost') ? 'VERSÃO LOCAL' : 'VERSÃO DE TESTE — mudanças aqui ainda não estão no sistema oficial'
  document.body.appendChild(f)
}
