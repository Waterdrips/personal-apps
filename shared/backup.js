// Export / import an app's whole IndexedDB as JSON — the safety net for "mobile only" storage.

export async function exportDb(db, appId, { includeSettings = false } = {}) {
  const tables = {};
  for (const table of db.tables) {
    if (table.name === 'settings' && !includeSettings) continue;
    tables[table.name] = await table.toArray();
  }
  const payload = { app: appId, schema: db.verno, exportedAt: new Date().toISOString(), tables };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${appId}-backup-${payload.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importDb(db, file) {
  const payload = JSON.parse(await file.text());
  if (!payload?.tables) throw new Error('Not a backup file');
  await db.transaction('rw', db.tables, async () => {
    for (const [name, rows] of Object.entries(payload.tables)) {
      const table = db.tables.find((t) => t.name === name);
      if (!table) continue;
      await table.clear();
      await table.bulkPut(rows);
    }
  });
}
