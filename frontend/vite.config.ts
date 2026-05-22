import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devServerPort = Number.parseInt(process.env.PORT ?? '5173', 10)
const backendProxyTarget = process.env.BACKEND_PROXY_TARGET || 'http://localhost:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: devServerPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
})
