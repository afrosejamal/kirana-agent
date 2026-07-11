import db from "../db";

export function setPreference(key: string, value: string) {
  db.prepare(`
    INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
  return { key, value };
}

export function getPreference(key: string) {
  const row = db.prepare(`SELECT value FROM preferences WHERE key = ?`).get(key) as any;
  return row?.value ?? null;
}

export function getAllPreferences(): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM preferences`).all() as any[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}