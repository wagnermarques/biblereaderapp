import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Repo name on GitHub Pages — update if the repository is renamed.
const REPO_NAME = 'biblereaderapp'

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bíblia PWA',
        short_name: 'Bíblia',
        description: 'Leitor de Bíblia offline em português',
        lang: 'pt-BR',
        start_url: '.',
        display: 'standalone',
        background_color: '#fffbfe',
        theme_color: '#6750a4',
        icons: [
          { src: 'icons/icon-48.png', sizes: '48x48', type: 'image/png' },
          { src: 'icons/icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + every book JSON (public/data/**) so the whole
        // Bible works offline after the first visit. This makes the service worker
        // download ~4 MB on install — expected for an offline-first Bible reader.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
