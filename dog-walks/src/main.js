import '../../shared/ui.css';
import { initTabs, esc } from '../../shared/shell.js';
import { getPosition, distanceKm, driveMinutesToKm, kmToDriveMinutes, mapsLink } from '../../shared/geo.js';
import { renderSettings, getSetting } from '../../shared/settings.js';
import { db, SETTINGS } from './db.js';
import { findSpots } from './overpass.js';
import { scoreSpot } from './scoring.js';
import { driveTimes } from './routing.js';

document.documentElement.style.setProperty('--accent', '#2f6b4f');

const $ = (s) => document.querySelector(s);
const statusEl = $('#status');
const resultsEl = $('#results');
let lastResults = [];

initTabs({
  saved: renderSaved,
  settings: () => renderSettings($('[data-panel="settings"]'), db, SETTINGS, 'dog-walks'),
});

$('#search').addEventListener('click', search);

async function search() {
  const maxMin = Number($('#minutes').value);
  const btn = $('#search');
  btn.disabled = true;
  resultsEl.innerHTML = '';
  try {
    setStatus('Finding you…');
    const here = await getPosition();

    setStatus('Looking for parks, woods and commons…');
    const radiusKm = driveMinutesToKm(maxMin) * 1.15; // a little slack; real times trim it later
    const { spots, raw } = await findSpots(here, radiusKm, await getSetting(db, 'overpassUrl'), setStatus);

    let candidates = spots.map((s) => {
      const km = distanceKm(here, s);
      return { ...s, km, driveMin: kmToDriveMinutes(km), estimated: true };
    });
    candidates = dedupe(candidates)
      .map((s) => ({ ...s, ...scoreSpot(s, s.driveMin, maxMin * 1.15) }))
      .filter((s) => !s.excluded)
      .sort((a, b) => b.score - a.score)
      .slice(0, 49);

    const orsKey = await getSetting(db, 'orsKey');
    if (orsKey && candidates.length) {
      setStatus('Getting real drive times…');
      try {
        const mins = await driveTimes(here, candidates, orsKey);
        candidates = candidates.map((s, i) => ({ ...s, driveMin: mins[i] ?? s.driveMin, estimated: mins[i] == null }));
      } catch (e) {
        setStatus(e.message);
      }
    }

    lastResults = candidates
      .map((s) => ({ ...s, ...scoreSpot(s, s.driveMin, maxMin) }))
      .filter((s) => !s.excluded)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    setStatus(
      lastResults.length
        ? `${lastResults.length} walks within ${maxMin} min${orsKey ? '' : ' (drive times estimated — add a key in Settings for real ones)'}`
        : `Nothing suitable found (map returned ${raw} places, ${spots.length} usable) — try a longer drive time.`
    );
    await renderResults();
  } catch (e) {
    setStatus(e.message || String(e));
  } finally {
    btn.disabled = false;
  }
}

/** OSM often maps one place several times (park + wood with the same name). Keep the best. */
function dedupe(spots) {
  const kept = [];
  for (const s of spots) {
    const i = kept.findIndex((k) => k.name.toLowerCase() === s.name.toLowerCase() && distanceKm(k, s) < 3);
    if (i === -1) kept.push(s);
    else if (s.areaKm2 > kept[i].areaKm2) kept[i] = s;
  }
  return kept;
}

async function renderResults() {
  const savedIds = new Set((await db.favourites.toArray()).map((f) => f.id));
  resultsEl.innerHTML = lastResults.map((s) => cardHtml(s, savedIds.has(s.id))).join('');
  resultsEl.querySelectorAll('[data-save]').forEach((b) =>
    b.addEventListener('click', async () => {
      const spot = lastResults.find((s) => s.id === b.dataset.save);
      await toggleFavourite(spot);
      renderResults();
    })
  );
}

function cardHtml(s, saved) {
  const time = `${s.estimated ? '~' : ''}${s.driveMin} min`;
  return `
    <article class="card" style="display:block">
      <div class="row" style="justify-content:space-between">
        <strong>${esc(s.name)}</strong>
        <span class="small muted">${time}</span>
      </div>
      <div class="chips" style="margin:6px 0 10px">
        <span class="chip">${esc(s.kind)}</span>
        ${s.reasons.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}
      </div>
      <div class="row">
        <a class="button" href="${mapsLink(s, s.name)}" target="_blank" rel="noopener">Directions</a>
        <button class="ghost" data-save="${esc(s.id)}">${saved ? '★ Saved' : '☆ Save'}</button>
      </div>
    </article>`;
}

async function toggleFavourite(spot) {
  if (await db.favourites.get(spot.id)) return db.favourites.delete(spot.id);
  const { id, name, kind, lat, lon, tags } = spot;
  return db.favourites.put({ id, name, kind, lat, lon, tags, note: '', savedAt: Date.now() });
}

async function renderSaved() {
  const list = $('#saved-list');
  const favs = await db.favourites.orderBy('savedAt').reverse().toArray();
  if (!favs.length) {
    list.innerHTML = '<p class="muted">Nothing saved yet. Tap ☆ on a walk to keep it here — saved walks work offline.</p>';
    return;
  }
  list.innerHTML = favs
    .map(
      (f) => `
    <article class="card" style="display:block">
      <div class="row" style="justify-content:space-between">
        <strong>${esc(f.name)}</strong><span class="chip">${esc(f.kind)}</span>
      </div>
      <input data-note="${esc(f.id)}" value="${esc(f.note)}" placeholder="Notes: parking, mud, off-lead bits…" style="width:100%;margin:8px 0" />
      <div class="row">
        <a class="button" href="${mapsLink(f, f.name)}" target="_blank" rel="noopener">Directions</a>
        <button class="ghost" data-remove="${esc(f.id)}">Remove</button>
      </div>
    </article>`
    )
    .join('');
  list.querySelectorAll('[data-note]').forEach((i) =>
    i.addEventListener('change', () => db.favourites.update(i.dataset.note, { note: i.value }))
  );
  list.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', async () => {
      await db.favourites.delete(b.dataset.remove);
      renderSaved();
    })
  );
}

function setStatus(msg) {
  statusEl.textContent = msg;
}
