import '../../shared/ui.css';
import { initTabs, esc } from '../../shared/shell.js';
import { openDb } from '../../shared/db.js';
import { renderSettings, getSetting } from '../../shared/settings.js';

document.documentElement.style.setProperty('--accent', '#b8432f');

const db = openDb('cycling', {
  1: { rides: '++id, date', plans: '++id, startDate' },
});

const SETTINGS = [
  { key: 'ftp', label: 'FTP (watts)', type: 'number', help: 'From a 20-min test: average power × 0.95.' },
  { key: 'maxHr', label: 'Max heart rate (bpm)', type: 'number' },
];

// Coggan power zones (% of FTP) and matching heart-rate bands (% of max HR).
const ZONES = [
  { n: 1, name: 'Recovery', ftp: [0, 55], hr: [50, 60] },
  { n: 2, name: 'Endurance', ftp: [56, 75], hr: [60, 70] },
  { n: 3, name: 'Tempo', ftp: [76, 90], hr: [70, 80] },
  { n: 4, name: 'Threshold', ftp: [91, 105], hr: [80, 90] },
  { n: 5, name: 'VO₂ max', ftp: [106, 120], hr: [90, 95] },
  { n: 6, name: 'Anaerobic', ftp: [121, 150], hr: [95, 100] },
];

initTabs({
  zones: renderZones,
  settings: () => renderSettings(document.querySelector('[data-panel="settings"]'), db, SETTINGS, 'cycling'),
});

async function renderZones() {
  const ftp = Number(await getSetting(db, 'ftp')) || 0;
  const maxHr = Number(await getSetting(db, 'maxHr')) || 0;
  const el = document.getElementById('zones');
  if (!ftp && !maxHr) {
    el.innerHTML = '<a class="button" href="#settings">Add FTP / max HR</a>';
    return;
  }
  const pct = (v, [lo, hi]) => `${Math.round((v * lo) / 100)}–${Math.round((v * hi) / 100)}`;
  el.innerHTML = ZONES.map(
    (z) => `
      <div class="card" style="justify-content:space-between">
        <span><strong>Z${z.n}</strong> ${esc(z.name)}</span>
        <span class="small">${ftp ? `${pct(ftp, z.ftp)} W` : ''}${ftp && maxHr ? ' · ' : ''}${maxHr ? `${pct(maxHr, z.hr)} bpm` : ''}</span>
      </div>`
  ).join('');
}
