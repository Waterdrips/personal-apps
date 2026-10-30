// Settings & API keys, kept only in this phone's storage (the app's IndexedDB).
// Nothing here is ever committed to the repo or sent anywhere except the API it belongs to.
import { exportDb, importDb } from './backup.js';
import { storageStatus } from './db.js';

export async function getSetting(db, key, fallback = '') {
  return (await db.settings.get(key))?.value ?? fallback;
}

export async function setSetting(db, key, value) {
  if (value === '' || value == null) return db.settings.delete(key);
  return db.settings.put({ key, value });
}

/**
 * Renders a settings screen.
 * @param {HTMLElement} el
 * @param {import('dexie').Dexie} db
 * @param {{ key:string, label:string, help?:string, secret?:boolean, type?:string }[]} fields
 * @param {string} appId  used for the backup file name
 */
export async function renderSettings(el, db, fields, appId) {
  const values = Object.fromEntries(
    await Promise.all(fields.map(async (f) => [f.key, await getSetting(db, f.key)]))
  );
  const status = await storageStatus();

  el.innerHTML = `
    <section class="stack">
      <h2>Settings</h2>
      <p class="muted small">Keys are stored on this phone only. They're left out of backups unless you tick the box.</p>
      <form class="stack" id="settings-form">
        ${fields
          .map(
            (f) => `
          <label class="field">
            <span>${f.label}</span>
            <span class="row">
              <input name="${f.key}" type="${f.secret ? 'password' : f.type ?? 'text'}"
                     value="${escapeAttr(values[f.key])}" autocomplete="off" spellcheck="false" />
              ${f.secret ? `<button type="button" class="ghost" data-reveal="${f.key}">Show</button>` : ''}
            </span>
            ${f.help ? `<small class="muted">${f.help}</small>` : ''}
          </label>`
          )
          .join('')}
        <button type="submit">Save</button>
        <p class="small" id="saved" hidden>Saved ✓</p>
      </form>

      <h2>Backup</h2>
      <p class="muted small">Storage ${status.persisted ? 'is protected from clean-up' : 'may be cleared by Android — install the app to protect it'} · ${status.usageMB} MB used</p>
      <label class="row small"><input type="checkbox" id="include-keys" /> Include API keys in export</label>
      <div class="row">
        <button type="button" class="ghost" id="export">Export JSON</button>
        <label class="button ghost">Import JSON<input type="file" id="import" accept="application/json" hidden /></label>
      </div>
    </section>`;

  const form = el.querySelector('#settings-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    for (const f of fields) await setSetting(db, f.key, String(data.get(f.key) ?? '').trim());
    const saved = el.querySelector('#saved');
    saved.hidden = false;
    setTimeout(() => (saved.hidden = true), 1500);
  });

  el.querySelectorAll('[data-reveal]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const input = form.elements.namedItem(btn.dataset.reveal);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    })
  );

  el.querySelector('#export').addEventListener('click', () =>
    exportDb(db, appId, { includeSettings: el.querySelector('#include-keys').checked })
  );
  el.querySelector('#import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Replace this app’s data with the backup?')) return;
    await importDb(db, file);
    location.reload();
  });
}

function escapeAttr(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
