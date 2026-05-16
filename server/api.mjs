import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(rootDir, 'data');
const dbPath = join(dataDir, 'levtia-library.sqlite');
const PORT = Number(process.env.LEVTIA_API_PORT || 4174);

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) {
        request.destroy();
        reject(new Error('Payload is too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function send(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

function getState() {
  const selectState = db.prepare('SELECT payload, updated_at FROM app_state WHERE id = ?');
  const row = selectState.get('main');
  if (!row) return null;
  return {
    state: JSON.parse(row.payload),
    updatedAt: row.updated_at,
  };
}

function saveState(state) {
  const updatedAt = new Date().toISOString();
  const upsertState = db.prepare(`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  upsertState.run('main', JSON.stringify(state), updatedAt);
  return { state, updatedAt };
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      send(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      send(response, 200, { ok: true, dbPath });
      return;
    }

    if (url.pathname === '/api/state' && request.method === 'GET') {
      send(response, 200, getState() ?? { state: null, updatedAt: null });
      return;
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      const body = await readBody(request);
      const parsed = JSON.parse(body || '{}');
      if (!parsed.state || typeof parsed.state !== 'object') {
        send(response, 400, { error: 'state is required' });
        return;
      }
      send(response, 200, saveState(parsed.state));
      return;
    }

    if (url.pathname === '/api/reset' && request.method === 'POST') {
      const deleteState = db.prepare('DELETE FROM app_state WHERE id = ?');
      deleteState.run('main');
      send(response, 200, { ok: true });
      return;
    }

    send(response, 404, { error: 'Not found' });
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : 'Unknown server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`LEVTIA Library API: http://127.0.0.1:${PORT}`);
  console.log(`SQLite DB: ${dbPath}`);
});
