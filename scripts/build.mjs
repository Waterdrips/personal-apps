// Builds every app in apps.json, then writes the launcher page at dist/index.html.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync('apps.json', 'utf8'));

for (const app of registry.apps) {
  console.log(`\n▶ building ${app.id}`);
  execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, APP: app.id } });
}

const cards = registry.apps
  .map(
    (a) => `      <a class="card" href="./${a.id}/" style="--accent:${a.theme_color}">
        <img src="./${a.id}/icons/icon-192.png" alt="" width="56" height="56" />
        <span><strong>${a.name}</strong><small>${a.description}</small></span>
      </a>`
  )
  .join('\n');

const html = readFileSync('launcher/index.html', 'utf8').replace('<!-- APPS -->', cards);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
copyFileSync('shared/ui.css', 'dist/ui.css');
// GitHub Pages: don't run Jekyll over the output.
writeFileSync('dist/.nojekyll', '');
console.log('\n✔ dist/ ready');
