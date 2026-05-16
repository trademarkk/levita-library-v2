import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(rootDir, 'data');
const dbPath = join(dataDir, 'levtia-library.sqlite');

function loadDotEnv() {
  const envPath = join(rootDir, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();
const PORT = Number(process.env.LEVTIA_API_PORT || 4174);

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER NOT NULL,
    scope TEXT,
    token_type TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS google_oauth_states (
    state TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
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

function redirect(response, location) {
  response.writeHead(302, {
    Location: location,
    'Access-Control-Allow-Origin': '*',
  });
  response.end();
}

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/google/callback`,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    appOrigin: process.env.LEVTIA_APP_ORIGIN || 'http://127.0.0.1:5173',
  };
}

function getGoogleToken() {
  return db.prepare('SELECT * FROM google_calendar_tokens WHERE id = ?').get('main');
}

function saveGoogleToken(token) {
  const existing = getGoogleToken();
  const expiresAt = Date.now() + Math.max(0, Number(token.expires_in || 0) - 60) * 1000;
  db.prepare(`
    INSERT INTO google_calendar_tokens (id, access_token, refresh_token, expires_at, scope, token_type, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, google_calendar_tokens.refresh_token),
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      token_type = excluded.token_type,
      updated_at = excluded.updated_at
  `).run(
    'main',
    token.access_token,
    token.refresh_token || existing?.refresh_token || null,
    expiresAt,
    token.scope || existing?.scope || null,
    token.token_type || existing?.token_type || 'Bearer',
    new Date().toISOString(),
  );
}

async function exchangeGoogleToken(params) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'Google OAuth token request failed.');
  return payload;
}

async function getGoogleAccessToken() {
  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret) {
    const error = new Error('Google Calendar не настроен: добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.');
    error.statusCode = 409;
    throw error;
  }

  const token = getGoogleToken();
  if (!token?.access_token) {
    const error = new Error('Google Calendar не подключен.');
    error.statusCode = 409;
    throw error;
  }

  if (Number(token.expires_at) > Date.now()) return token.access_token;
  if (!token.refresh_token) {
    const error = new Error('Нет refresh token Google Calendar. Подключите календарь заново.');
    error.statusCode = 409;
    throw error;
  }

  const refreshed = await exchangeGoogleToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  });
  saveGoogleToken(refreshed);
  return refreshed.access_token;
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

async function googleCalendarRequest(path, options = {}) {
  const config = getGoogleConfig();
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || payload.error_description || 'Google Calendar request failed.');
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function googleEventPayload(input) {
  return {
    summary: input.title,
    description: input.description || '',
    start: { date: input.date },
    end: { date: nextDate(input.date) },
  };
}

function normalizeGoogleEvent(event) {
  const date = event.start?.date || String(event.start?.dateTime || '').slice(0, 10);
  return {
    googleEventId: event.id,
    googleHtmlLink: event.htmlLink || null,
    title: event.summary || 'Без названия',
    date,
    description: event.description || null,
    updated: event.updated || null,
  };
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

    if (url.pathname === '/api/google/status' && request.method === 'GET') {
      const config = getGoogleConfig();
      const token = getGoogleToken();
      send(response, 200, {
        configured: Boolean(config.clientId && config.clientSecret),
        connected: Boolean(token?.refresh_token || token?.access_token),
        calendarId: config.calendarId,
        redirectUri: config.redirectUri,
      });
      return;
    }

    if (url.pathname === '/api/google/connect' && request.method === 'GET') {
      const config = getGoogleConfig();
      if (!config.clientId || !config.clientSecret) {
        send(response, 409, { error: 'Google Calendar не настроен: добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.' });
        return;
      }
      const state = randomUUID();
      db.prepare('DELETE FROM google_oauth_states WHERE created_at < ?').run(Date.now() - 10 * 60 * 1000);
      db.prepare('INSERT INTO google_oauth_states (state, created_at) VALUES (?, ?)').run(state, Date.now());
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);
      redirect(response, authUrl.toString());
      return;
    }

    if (url.pathname === '/api/google/callback' && request.method === 'GET') {
      const config = getGoogleConfig();
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const savedState = state ? db.prepare('SELECT state FROM google_oauth_states WHERE state = ?').get(state) : null;
      if (!code || !state || !savedState) {
        redirect(response, `${config.appOrigin}/settings?google=error`);
        return;
      }
      db.prepare('DELETE FROM google_oauth_states WHERE state = ?').run(state);
      const token = await exchangeGoogleToken({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      });
      saveGoogleToken(token);
      redirect(response, `${config.appOrigin}/settings?google=connected`);
      return;
    }

    if (url.pathname === '/api/google/events' && request.method === 'POST') {
      const body = JSON.parse(await readBody(request) || '{}');
      if (!body.title || !body.date) {
        send(response, 400, { error: 'title and date are required' });
        return;
      }
      const event = await googleCalendarRequest('/events', {
        method: 'POST',
        body: JSON.stringify(googleEventPayload(body)),
      });
      send(response, 200, { googleEventId: event.id, googleHtmlLink: event.htmlLink });
      return;
    }

    if (url.pathname === '/api/google/events' && request.method === 'GET') {
      const timeMin = url.searchParams.get('timeMin');
      const timeMax = url.searchParams.get('timeMax');
      if (!timeMin || !timeMax) {
        send(response, 400, { error: 'timeMin and timeMax are required' });
        return;
      }
      const params = new URLSearchParams({
        timeMin: `${timeMin}T00:00:00.000Z`,
        timeMax: `${timeMax}T00:00:00.000Z`,
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      const payload = await googleCalendarRequest(`/events?${params.toString()}`, { method: 'GET' });
      send(response, 200, { events: (payload.items || []).map(normalizeGoogleEvent).filter((event) => event.date) });
      return;
    }

    if (url.pathname.startsWith('/api/google/events/') && request.method === 'PATCH') {
      const googleEventId = decodeURIComponent(url.pathname.replace('/api/google/events/', ''));
      const body = JSON.parse(await readBody(request) || '{}');
      if (!googleEventId || !body.title || !body.date) {
        send(response, 400, { error: 'googleEventId, title and date are required' });
        return;
      }
      const event = await googleCalendarRequest(`/events/${encodeURIComponent(googleEventId)}`, {
        method: 'PATCH',
        body: JSON.stringify(googleEventPayload(body)),
      });
      send(response, 200, { googleEventId: event.id, googleHtmlLink: event.htmlLink });
      return;
    }

    if (url.pathname.startsWith('/api/google/events/') && request.method === 'DELETE') {
      const googleEventId = decodeURIComponent(url.pathname.replace('/api/google/events/', ''));
      if (googleEventId) {
        await googleCalendarRequest(`/events/${encodeURIComponent(googleEventId)}`, { method: 'DELETE' });
      }
      send(response, 200, { ok: true });
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
    send(response, error.statusCode || 500, { error: error instanceof Error ? error.message : 'Unknown server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`LEVTIA Library API: http://127.0.0.1:${PORT}`);
  console.log(`SQLite DB: ${dbPath}`);
});
