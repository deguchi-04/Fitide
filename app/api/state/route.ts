import { env } from 'cloudflare:workers';

const createSql = `CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

async function ensureTable() {
  await env.DB.prepare(createSql).run();
}

export async function GET() {
  await ensureTable();
  const row = await env.DB.prepare('SELECT payload, updated_at FROM app_state WHERE id = ?')
    .bind(1)
    .first<{ payload: string; updated_at: string }>();
  return Response.json(row ? { state: JSON.parse(row.payload), updatedAt: row.updated_at } : { state: null });
}

export async function PUT(request: Request) {
  await ensureTable();
  const state = await request.json();
  const payload = JSON.stringify(state);
  if (payload.length > 1_000_000) {
    return Response.json({ error: 'O registo excede o limite suportado.' }, { status: 413 });
  }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO app_state (id, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(1, payload, updatedAt)
    .run();
  return Response.json({ ok: true, updatedAt });
}

export async function DELETE() {
  await ensureTable();
  await env.DB.prepare('DELETE FROM app_state WHERE id = ?').bind(1).run();
  return Response.json({ ok: true });
}
