import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// porta 5174 para não brigar com o Unique Clinical (5173)
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
})
