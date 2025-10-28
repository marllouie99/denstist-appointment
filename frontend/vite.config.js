import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT || 8080,
    strictPort: false,
    allowedHosts: ['*']
  }
})
