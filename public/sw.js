// Service worker mínimo: deixa o sistema instalável no celular/computador e abre a conversa ao tocar no aviso.
// Não guarda nada em cache (o sistema precisa estar sempre atualizado).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = (e.notification.data && e.notification.data.url) || '/atendimento'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
    for (const c of abertas) { if ('focus' in c) { c.navigate(destino); return c.focus() } }
    return self.clients.openWindow(destino)
  }))
})
