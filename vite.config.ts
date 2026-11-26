import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const rawBase = process.env.VITE_APP_BASE || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return {
    base,
    build: { manifest: true },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['logo.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: base,
          name: 'OpenNews — Freie Nachrichten',
          short_name: 'OpenNews',
          description: 'Minimalistische Nachrichten-App für freie RSS-, Atom- und JSON-Feeds mit lokaler Personalisierung und BYOK-KI.',
          theme_color: '#f6f5f2',
          background_color: '#f6f5f2',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['index.html', 'assets/*.{js,css}', 'icon.svg', 'pwa-192x192.png', 'theme-init.js'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.(?:js|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'opennews-chunks-v1',
                expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/(?:source-icons|assets)\/.*\.(?:png|webp|jpg|svg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'opennews-media-v1',
                expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
