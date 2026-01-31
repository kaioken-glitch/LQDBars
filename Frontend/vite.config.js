import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/lastfm': {
        target: 'https://ws.audioscrobbler.com/2.0',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lastfm/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying request to Last.fm:', req.url);
          });
        }
      }
    }
  }
})
