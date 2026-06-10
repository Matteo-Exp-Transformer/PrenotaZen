import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
const commitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' }
})()
const buildDate = new Date().toISOString().slice(0, 10)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': il nuovo SW resta in waiting e NON si auto-attiva durante la sessione.
      // Lo swap avviene solo all'avvio successivo (logica in src/main.tsx).
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon-v2.ico',
        'icons/apple-touch-icon-v2.png',
        'login/admin-login-bg.png',
        'login/admin-login-bg-mobile.png',
      ],
      manifest: {
        name: 'CalendarBackup',
        short_name: 'CalBackup',
        description: 'Sistema di prenotazioni per ristoranti',
        start_url: '/admin',
        scope: '/',
        display: 'standalone',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icons/icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512-v2.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/apple-touch-icon-v2.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Mai attivare il nuovo SW da solo: lo swap è controllato in main.tsx (solo all'avvio).
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            // Do not cache Supabase API/auth requests to avoid stale tenant/auth data.
            urlPattern: ({ url, request }) =>
              !url.hostname.includes('supabase.co') &&
              ['style', 'script', 'font', 'image', 'manifest'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
})
