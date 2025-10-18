import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/ws-public': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/outputs': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/config.js': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
