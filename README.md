# Personal apps

A suite of small offline-first PWAs, hosted on GitHub Pages and installed on Android from Chrome.
Each app has its own manifest and service worker, so each one installs as a separate app.

| App | URL |
| --- | --- |
| Launcher | https://waterdrips.github.io/personal-apps/ |
| Dog Walks | https://waterdrips.github.io/personal-apps/dog-walks/ |
| Cycling Plan | https://waterdrips.github.io/personal-apps/cycling/ |

## Develop

```sh
npm install
APP=dog-walks npm run dev   # one app at a time
npm run build               # every app → dist/, plus the launcher
npm run icons               # regenerate placeholder icons from apps.json
```

## How it fits together

```
apps.json          registry: id, name, colour — drives the build, manifests and launcher
vite.config.js     one Vite + PWA config, parameterised by APP
scripts/build.mjs  builds each app into dist/<id>/ and writes dist/index.html
launcher/          the home page listing all apps
shared/            code bundled into every app
  db.js            Dexie per app (`pa:<id>`), asks Android to persist storage
  settings.js      settings screen; API keys stay in the phone's IndexedDB
  backup.js        export / import JSON (keys excluded unless you tick the box)
  geo.js           location, distances, rough drive-time estimates
  shell.js         bottom tab bar + hash routing
  ui.css           shared styles, light/dark
<app>/             index.html, src/, public/icons/
```

## API keys

Never commit keys. Each app's **Settings** tab stores them in that app's IndexedDB on the phone,
and the app only sends a key to the API it belongs to. Because the site is public and static,
anything needing a client *secret* (e.g. Strava OAuth) will need a tiny serverless proxy.

- **Dog Walks:** optional [OpenRouteService](https://openrouteservice.org) key for real drive times.
  Without it, drive times are estimated from straight-line distance.

## Add an app

1. Add an entry to `apps.json`.
2. Copy `cycling/` as a starting point and rename it to the new id.
3. `npm run icons`, then build.

## Deploy

Push to `main`. The workflow builds and publishes `dist/` to the `gh-pages` branch, which Pages serves.
If the site ever 404s, check repo **Settings → Pages → Deploy from a branch: `gh-pages` / root**.
