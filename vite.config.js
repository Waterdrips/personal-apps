// One build per app. `APP=dog-walks npm run dev` to work on a single app;
// `npm run build` (scripts/build.mjs) builds every app in apps.json into dist/<id>/.
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = JSON.parse(readFileSync(new URL('./apps.json', import.meta.url)));
const id = process.env.APP || registry.apps[0].id;
const app = registry.apps.find((a) => a.id === id);
if (!app) throw new Error(`Unknown APP "${id}" - add it to apps.json`);

const base = `/${registry.repo}/${app.id}/`;

export default defineConfig({
  root: resolve(app.id),
  base,
  publicDir: resolve(app.id, 'public'),
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: resolve('dist', app.id),
    emptyOutDir: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Each app gets its own scope, so Android installs them as separate apps.
      scope: base,
      manifest: {
        id: base,
        name: app.name,
        short_name: app.short_name,
        description: app.description,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ef',
        theme_color: app.theme_color,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
});
