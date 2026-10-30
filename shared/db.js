// Per-app IndexedDB via Dexie. Every app on waterdrips.github.io shares one storage
// origin, so the database name is always prefixed with the app id.
import Dexie from 'dexie';

/**
 * @param {string} appId  e.g. 'dog-walks'
 * @param {Record<number, Record<string,string>>} versions  Dexie schemas by version number,
 *        e.g. { 1: { favourites: 'id, savedAt' } }. A `settings` store is always added.
 */
export function openDb(appId, versions) {
  const db = new Dexie(`pa:${appId}`);
  for (const [v, stores] of Object.entries(versions)) {
    db.version(Number(v)).stores({ settings: 'key', ...stores });
  }
  requestPersistence();
  return db;
}

let asked = false;
/** Ask the browser not to evict our data. Installed PWAs on Android are usually granted this. */
export async function requestPersistence() {
  if (asked || !navigator.storage?.persist) return;
  asked = true;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not fatal */
  }
}

export async function storageStatus() {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const est = (await navigator.storage?.estimate?.()) ?? {};
  return { persisted, usageMB: ((est.usage ?? 0) / 1e6).toFixed(1) };
}
