import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { getBackendUrl } from '../scripts/backend-url.js'

const backendUrl = getBackendUrl()

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
    server: {
    port: 5174,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/storage': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
