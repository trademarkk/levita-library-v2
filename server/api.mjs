import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';

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
const GOOGLE_REQUEST_TIMEOUT_MS = Number(process.env.GOOGLE_REQUEST_TIMEOUT_MS || 12000);
const GOOGLE_TASK_HISTORY_LIMIT = Number(process.env.GOOGLE_TASK_HISTORY_LIMIT || 500);
const MAX_REQUEST_TIMEOUT_MS = Number(process.env.MAX_REQUEST_TIMEOUT_MS || 12000);
const MAX_API_BASE = process.env.MAX_API_BASE || 'https://platform-api.max.ru';
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || '';
const MAX_REPORT_CHAT_ID = process.env.MAX_REPORT_CHAT_ID || '';
const MAX_REPORT_CHAT_ID_STAVROPOLSKAYA = process.env.MAX_REPORT_CHAT_ID_STAVROPOLSKAYA || MAX_REPORT_CHAT_ID;
const MAX_REPORT_CHAT_ID_MACHUGI = process.env.MAX_REPORT_CHAT_ID_MACHUGI || '';
const STORAGE_DRIVER = process.env.LEVTIA_STORAGE_DRIVER || 'sqlite';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const useSupabase = STORAGE_DRIVER === 'supabase';

mkdirSync(dataDir, { recursive: true });

if (useSupabase && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error('Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const db = useSupabase ? null : new DatabaseSync(dbPath);
const supabase = useSupabase
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (db) {
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
}

async function supabaseSingle(query, action) {
  const { data, error } = await query;
  if (error) throw new Error(`Supabase ${action} failed: ${error.message}`);
  return data ?? null;
}

async function supabaseRun(query, action) {
  const { error } = await query;
  if (error) throw new Error(`Supabase ${action} failed: ${error.message}`);
}

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
    includeAllCalendars: process.env.GOOGLE_INCLUDE_ALL_CALENDARS !== 'false',
    includeTasks: process.env.GOOGLE_INCLUDE_TASKS !== 'false',
    timeZone: process.env.GOOGLE_TIME_ZONE || 'Europe/Moscow',
    appOrigin: process.env.LEVTIA_APP_ORIGIN || 'http://127.0.0.1:5173',
  };
}

function getMaxConfig() {
  const stavropolskayaChatId = MAX_REPORT_CHAT_ID_STAVROPOLSKAYA || MAX_REPORT_CHAT_ID;
  return {
    apiBase: MAX_API_BASE.replace(/\/+$/, ''),
    botToken: normalizeMaxToken(MAX_BOT_TOKEN),
    reportChatIds: {
      STAVROPOLSKAYA: stavropolskayaChatId,
      MACHUGI: MAX_REPORT_CHAT_ID_MACHUGI,
    },
  };
}

function normalizeMaxToken(value) {
  return String(value || '')
    .trim()
    .replace(/^Authorization:\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

function formatReportDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return value || '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function formatReportTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function maxReportText(input) {
  const report = input.report || {};
  const submittedAt = report.submittedAt || new Date().toISOString();
  const studio = report.studio === 'MACHUGI' ? 'Мачуги' : 'Ставропольская';
  return [
    `Отчёт ${input.slot || report.slot || ''}`,
    `Студия: ${studio}`,
    `Дата: ${formatReportDate(input.checklistDate || submittedAt)}`,
    `Администратор: ${report.adminName || input.assigneeName || 'Не указан'}`,
    '',
    `Звонки: ${report.calls || '0'}`,
    `Дозвоны: ${report.reached || '0'}`,
    `Записи: ${report.bookings || '0'}`,
    `Касса: ${report.cash || '0'}`,
    `Был: ${report.came || '0'}`,
    `Купил: ${report.bought || '0'}`,
    '',
    `Время сохранения: ${formatReportTime(submittedAt)}`,
  ].join('\n');
}

async function sendMaxMessage(text, studio = 'STAVROPOLSKAYA') {
  const config = getMaxConfig();
  const reportChatId = config.reportChatIds[studio] || '';
  if (!config.botToken) {
    const error = new Error('MAX не настроен: добавьте MAX_BOT_TOKEN.');
    error.statusCode = 409;
    throw error;
  }
  if (!reportChatId) {
    const studioName = studio === 'MACHUGI' ? 'Мачуги' : 'Ставропольская';
    const envName = studio === 'MACHUGI' ? 'MAX_REPORT_CHAT_ID_MACHUGI' : 'MAX_REPORT_CHAT_ID_STAVROPOLSKAYA или MAX_REPORT_CHAT_ID';
    const error = new Error(`MAX чат для студии ${studioName} не настроен: добавьте ${envName}.`);
    error.statusCode = 409;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_REQUEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ chat_id: reportChatId });
    const response = await fetch(`${config.apiBase}/messages?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: config.botToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, format: 'markdown', notify: true }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message || payload.error || payload.description || `MAX API вернул статус ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('MAX API не ответил вовремя.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getGoogleToken() {
  if (useSupabase) {
    return supabaseSingle(
      supabase.from('google_calendar_tokens').select('*').eq('id', 'main').maybeSingle(),
      'select google token',
    );
  }
  return db.prepare('SELECT * FROM google_calendar_tokens WHERE id = ?').get('main');
}

async function deleteGoogleToken() {
  if (useSupabase) {
    await supabaseRun(supabase.from('google_calendar_tokens').delete().eq('id', 'main'), 'delete google token');
    return;
  }
  db.prepare('DELETE FROM google_calendar_tokens WHERE id = ?').run('main');
}

async function saveGoogleToken(token) {
  const existing = await getGoogleToken();
  const expiresAt = Date.now() + Math.max(0, Number(token.expires_in || 0) - 60) * 1000;
  const payload = {
    id: 'main',
    access_token: token.access_token,
    refresh_token: token.refresh_token || existing?.refresh_token || null,
    expires_at: expiresAt,
    scope: token.scope || existing?.scope || null,
    token_type: token.token_type || existing?.token_type || 'Bearer',
    updated_at: new Date().toISOString(),
  };
  if (useSupabase) {
    await supabaseRun(supabase.from('google_calendar_tokens').upsert(payload, { onConflict: 'id' }), 'upsert google token');
    return;
  }
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
    payload.id,
    payload.access_token,
    payload.refresh_token,
    payload.expires_at,
    payload.scope,
    payload.token_type,
    payload.updated_at,
  );
}

async function exchangeGoogleToken(params) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error_description || payload.error || 'Google OAuth token request failed.');
    error.statusCode = response.status;
    error.googleError = payload.error || null;
    throw error;
  }
  return payload;
}

function isInvalidGoogleTokenError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.googleError === 'invalid_grant'
    || error?.googleError === 'invalid_token'
    || message.includes('expired or revoked')
    || message.includes('invalid credentials')
    || message.includes('invalid_grant')
    || message.includes('invalid_token');
}

function googleReconnectError(message = 'Google Calendar отключен. Подключите Google заново.') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

async function getGoogleAccessToken() {
  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret) {
    const error = new Error('Google Calendar не настроен: добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.');
    error.statusCode = 409;
    throw error;
  }

  const token = await getGoogleToken();
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

  let refreshed;
  try {
    refreshed = await exchangeGoogleToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    });
  } catch (error) {
    if (isInvalidGoogleTokenError(error)) {
      await deleteGoogleToken();
      throw googleReconnectError();
    }
    throw error;
  }
  await saveGoogleToken(refreshed);
  return refreshed.access_token;
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function addDays(date, offset) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const days = [];
  for (let date = start; date < end; date = addDays(date, 1)) days.push(date);
  return days;
}

function weekdayIndex(date) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function daysBetween(left, right) {
  return Math.floor((new Date(`${left}T00:00:00.000Z`).getTime() - new Date(`${right}T00:00:00.000Z`).getTime()) / 86_400_000);
}

function formatGoogleDateTime(value, timeZone) {
  if (!value) return { date: '', time: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: String(value).slice(0, 10), time: null };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

function addOneHour(time) {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  const total = (hours * 60 + minutes + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function googleCalendarRequest(path, options = {}) {
  const config = getGoogleConfig();
  const accessToken = await getGoogleAccessToken();
  const url = path.startsWith('/users/') || path.startsWith('/calendars/')
    ? `https://www.googleapis.com/calendar/v3${path}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const requestError = new Error(error?.name === 'AbortError' ? 'Google Calendar request timed out.' : 'Google Calendar request failed.');
    requestError.statusCode = error?.name === 'AbortError' ? 504 : 502;
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || payload.error_description || 'Google Calendar request failed.');
    error.statusCode = response.status;
    if (response.status === 401 || isInvalidGoogleTokenError(error)) await deleteGoogleToken();
    throw error;
  }
  return payload;
}

async function googleTasksRequest(path, options = {}) {
  const accessToken = await getGoogleAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const requestError = new Error(error?.name === 'AbortError' ? 'Google Tasks request timed out.' : 'Google Tasks request failed.');
    requestError.statusCode = error?.name === 'AbortError' ? 504 : 502;
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || payload.error_description || 'Google Tasks request failed.');
    error.statusCode = response.status;
    if (response.status === 401 || isInvalidGoogleTokenError(error)) await deleteGoogleToken();
    throw error;
  }
  return payload;
}

function googleEventPayload(input, options = {}) {
  const config = getGoogleConfig();
  const recurrence = googleRecurrencePayload(input.recurrence);
  const base = {
    summary: input.title,
    description: input.description || '',
    ...(recurrence.length || options.includeEmptyRecurrence ? { recurrence } : {}),
  };
  if (input.startTime) {
    const startTime = input.startTime;
    const endTime = input.endTime || addOneHour(input.startTime);
    return {
      ...base,
      start: { dateTime: `${input.date}T${startTime}:00`, timeZone: config.timeZone },
      end: { dateTime: `${input.date}T${endTime}:00`, timeZone: config.timeZone },
    };
  }

  return {
    ...base,
    start: { date: input.date },
    end: { date: nextDate(input.date) },
  };
}

function googleRecurrencePayload(recurrence) {
  if (!recurrence || recurrence.frequency !== 'weekly' || !Array.isArray(recurrence.weekdays) || !recurrence.weekdays.length) return [];
  const weekdayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byDay = recurrence.weekdays
    .map((day) => weekdayCodes[Number(day)])
    .filter(Boolean)
    .join(',');
  if (!byDay) return [];
  const parts = [
    'FREQ=WEEKLY',
    `INTERVAL=${Math.max(1, Number(recurrence.interval) || 1)}`,
    `BYDAY=${byDay}`,
  ];
  if (recurrence.until && /^\d{4}-\d{2}-\d{2}$/.test(recurrence.until)) {
    parts.push(`UNTIL=${recurrence.until.replaceAll('-', '')}T235959Z`);
  }
  return [`RRULE:${parts.join(';')}`];
}

function normalizeGoogleEvent(event) {
  const config = getGoogleConfig();
  const start = event.start?.date
    ? { date: event.start.date, time: null }
    : formatGoogleDateTime(event.start?.dateTime, event.start?.timeZone || config.timeZone);
  const end = event.end?.dateTime
    ? formatGoogleDateTime(event.end.dateTime, event.end?.timeZone || event.start?.timeZone || config.timeZone)
    : { date: '', time: null };
  return {
    googleEventId: event.id,
    googleRecurringEventId: event.recurringEventId || null,
    googleHtmlLink: event.htmlLink || null,
    title: event.summary || 'Без названия',
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    description: event.description || null,
    source: 'google-calendar',
    sourceName: event.calendarSummary || null,
    updated: event.updated || null,
  };
}

function toClock(hour, minute = '00') {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeRangeFromText(text = '') {
  const rangeWithMinutes = text.match(/(?:^|\s)([01]?\d|2[0-3])[:.](\d{2})\s*[-–—]\s*([01]?\d|2[0-3])(?::|\.)(\d{2})(?:\s|$)/);
  if (rangeWithMinutes) {
    return {
      startTime: toClock(rangeWithMinutes[1], rangeWithMinutes[2]),
      endTime: toClock(rangeWithMinutes[3], rangeWithMinutes[4]),
    };
  }

  const hourRange = text.match(/(?:^|\s)([01]?\d|2[0-3])\s*[-–—]\s*([01]?\d|2[0-3])(?:\s|$)/);
  if (hourRange) {
    return {
      startTime: toClock(hourRange[1]),
      endTime: toClock(hourRange[2]),
    };
  }

  const single = text.match(/(?:^|\s)([01]?\d|2[0-3])[:.](\d{2})(?:\s|$)/);
  if (single) {
    return {
      startTime: toClock(single[1], single[2]),
      endTime: null,
    };
  }

  return { startTime: null, endTime: null };
}

function normalizeGoogleTask(task, taskList) {
  const dueDate = task.due ? String(task.due).slice(0, 10) : '';
  const parsedTime = parseTimeRangeFromText(`${task.title || ''} ${task.notes || ''}`);
  return {
    googleEventId: `task:${taskList.id}:${task.id}`,
    googleHtmlLink: task.webViewLink || null,
    title: task.title || 'Задача без названия',
    date: dueDate,
    startTime: parsedTime.startTime,
    endTime: parsedTime.endTime,
    description: task.notes || null,
    source: 'google-task',
    sourceName: taskList.title || 'Google Tasks',
    updated: task.updated || null,
  };
}

function normalizeSearchText(value = '') {
  return String(value).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function recurringTaskKey(value = '') {
  return normalizeSearchText(value)
    .replace(/\b([01]?\d|2[0-3])[:.]\d{2}\b/g, ' ')
    .replace(/\b([01]?\d|2[0-3])\s*[-\u2013\u2014]\s*([01]?\d|2[0-3])\b/g, ' ')
    .replace(/(^|\s)с(?=\s|$)/gu, ' ')
    .replace(/[^\p{L}\p{N}:]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferredTaskTime(title) {
  const normalized = normalizeSearchText(title);
  const parsed = parseTimeRangeFromText(title);
  if (parsed.startTime || parsed.endTime) return parsed;
  if (normalized.includes('планерк') && normalized.includes('ук')) return { startTime: '08:40', endTime: null };
  if (normalized.includes('планерк') && normalized.includes('администратор')) return { startTime: '10:10', endTime: null };
  return { startTime: null, endTime: null };
}

function inferGoogleTaskRecurrence(task) {
  const dueDate = task.due ? String(task.due).slice(0, 10) : '';
  if (!dueDate) return null;
  const normalized = normalizeSearchText(task.title);
  const time = inferredTaskTime(task.title || '');

  if (normalized.includes('планерк') && (normalized.includes('ук') || normalized.includes('администратор'))) {
    return {
      frequency: 'weekly',
      interval: 1,
      weekdays: [1, 2, 3, 4, 5, 6],
      startTime: time.startTime,
      endTime: time.endTime,
      confidence: 'inferred-from-google-task-title',
    };
  }

  if (normalized.includes('зум') && normalized.includes('педагог')) {
    return {
      frequency: 'weekly',
      interval: 1,
      weekdays: [weekdayIndex(dueDate)],
      startTime: time.startTime,
      endTime: time.endTime,
      confidence: 'inferred-from-google-task-title',
    };
  }

  return null;
}

function latestGoogleTask(tasks) {
  return [...tasks].sort((left, right) => (
    String(right.due || '').localeCompare(String(left.due || ''))
    || String(right.updated || '').localeCompare(String(left.updated || ''))
  ))[0] || null;
}

function inferGoogleTaskGroupRecurrence(tasks) {
  const known = tasks
    .map((task) => ({ task, recurrence: inferGoogleTaskRecurrence(task) }))
    .filter((item) => item.recurrence)
    .sort((left, right) => String(right.task.updated || '').localeCompare(String(left.task.updated || '')))[0];
  if (known?.recurrence) return known.recurrence;

  const uniqueDates = Array.from(new Set(tasks
    .map((task) => (task.due ? String(task.due).slice(0, 10) : ''))
    .filter(Boolean)));
  if (uniqueDates.length < 2) return null;

  const weekdayCounts = new Map();
  for (const date of uniqueDates) {
    const weekday = weekdayIndex(date);
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
  }
  const weekdays = Array.from(weekdayCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([weekday]) => weekday)
    .sort((left, right) => left - right);
  if (!weekdays.length) return null;

  const latest = latestGoogleTask(tasks);
  const time = inferredTaskTime(`${latest?.title || ''} ${latest?.notes || ''}`);
  return {
    frequency: 'weekly',
    interval: 1,
    weekdays,
    startTime: time.startTime,
    endTime: time.endTime,
    confidence: 'inferred-from-google-task-history',
  };
}

function createVirtualRecurringGoogleTasks(tasks, taskList, timeMin, timeMax) {
  const groups = new Map();
  for (const task of tasks) {
    const dueDate = task.due ? String(task.due).slice(0, 10) : '';
    if (!dueDate) continue;
    const key = recurringTaskKey(task.title);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), task]);
  }

  const dates = dateRange(timeMin, timeMax);
  return Array.from(groups.values()).flatMap((groupTasks) => {
    const task = latestGoogleTask(groupTasks);
    const dueDate = task?.due ? String(task.due).slice(0, 10) : '';
    const recurrence = inferGoogleTaskGroupRecurrence(groupTasks);
    if (!task || !dueDate || !recurrence) return [];

    return dates
      .filter((date) => {
        if (date < dueDate) return false;
        if (!recurrence.weekdays.includes(weekdayIndex(date))) return false;
        if (recurrence.weekdays.length > 1) return true;
        return daysBetween(date, dueDate) % (7 * Math.max(1, recurrence.interval || 1)) === 0;
      })
      .map((date) => ({
        googleEventId: `task-recurring:${taskList.id}:${task.id}:${date}`,
        googleHtmlLink: task.webViewLink || null,
        title: task.title || 'Задача без названия',
        date,
        startTime: recurrence.startTime,
        endTime: recurrence.endTime,
        description: task.notes || null,
        source: 'google-task',
        sourceName: `${taskList.title || 'Google Tasks'} · повтор`,
        updated: task.updated || null,
      }));
  });
}

function dedupeImportedEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.date}|${event.startTime || ''}|${event.endTime || ''}|${recurringTaskKey(event.title)}|${event.source || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function listReadableCalendars() {
  const config = getGoogleConfig();
  if (!config.includeAllCalendars) return [{ id: config.calendarId, summary: config.calendarId }];

  try {
    const calendars = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({ minAccessRole: 'reader', maxResults: '250' });
      if (pageToken) params.set('pageToken', pageToken);
      const payload = await googleCalendarRequest(`/users/me/calendarList?${params.toString()}`, { method: 'GET' });
      calendars.push(...(payload.items || [])
        .filter((calendar) => !calendar.deleted && !calendar.hidden && calendar.id)
        .map((calendar) => ({ id: calendar.id, summary: calendar.summary || calendar.id })));
      pageToken = payload.nextPageToken || '';
    } while (pageToken);
    return calendars.length ? calendars : [{ id: config.calendarId, summary: config.calendarId }];
  } catch (error) {
    if (error.statusCode === 403) return [{ id: config.calendarId, summary: config.calendarId }];
    throw error;
  }
}

async function listGoogleEventsForRange(timeMin, timeMax) {
  const config = getGoogleConfig();
  const calendars = await listReadableCalendars();
  const params = new URLSearchParams({
    timeMin: `${timeMin}T00:00:00.000Z`,
    timeMax: `${timeMax}T00:00:00.000Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: config.timeZone,
    maxResults: '2500',
  });
  const batches = await Promise.all(calendars.map(async (calendar) => {
    try {
      const events = [];
      let pageToken = '';
      do {
        const pageParams = new URLSearchParams(params);
        if (pageToken) pageParams.set('pageToken', pageToken);
        const payload = await googleCalendarRequest(`/calendars/${encodeURIComponent(calendar.id)}/events?${pageParams.toString()}`, { method: 'GET' });
        events.push(...(payload.items || []).map((event) => normalizeGoogleEvent({ ...event, calendarSummary: calendar.summary })));
        pageToken = payload.nextPageToken || '';
      } while (pageToken);
      return events;
    } catch (error) {
      if (error.statusCode === 403 || error.statusCode === 404) return [];
      throw error;
    }
  }));
  return batches.flat();
}

async function listGoogleTasksForRange(timeMin, timeMax) {
  const config = getGoogleConfig();
  if (!config.includeTasks) return [];
  try {
    const taskLists = [];
    let listPageToken = '';
    do {
      const listParams = new URLSearchParams({ maxResults: '100' });
      if (listPageToken) listParams.set('pageToken', listPageToken);
      const listsPayload = await googleTasksRequest(`/users/@me/lists?${listParams.toString()}`, { method: 'GET' });
      taskLists.push(...(listsPayload.items || []));
      listPageToken = listsPayload.nextPageToken || '';
    } while (listPageToken);
    const params = new URLSearchParams({
      dueMin: `${timeMin}T00:00:00.000Z`,
      dueMax: `${timeMax}T00:00:00.000Z`,
      showCompleted: 'true',
      showDeleted: 'false',
      showHidden: 'true',
      showAssigned: 'true',
      maxResults: '100',
    });
    const historyParams = new URLSearchParams({
      showCompleted: 'true',
      showDeleted: 'false',
      showHidden: 'true',
      showAssigned: 'true',
      maxResults: '100',
    });
    const batches = await Promise.all(taskLists.map(async (taskList) => {
      const tasks = [];
      let taskPageToken = '';
      do {
        const pageParams = new URLSearchParams(params);
        if (taskPageToken) pageParams.set('pageToken', taskPageToken);
        const payload = await googleTasksRequest(`/lists/${encodeURIComponent(taskList.id)}/tasks?${pageParams.toString()}`, { method: 'GET' });
        tasks.push(...(payload.items || []).map((task) => normalizeGoogleTask(task, taskList)).filter((task) => task.date));
        taskPageToken = payload.nextPageToken || '';
      } while (taskPageToken);

      const historyTasks = [];
      let historyPageToken = '';
      do {
        const pageParams = new URLSearchParams(historyParams);
        if (historyPageToken) pageParams.set('pageToken', historyPageToken);
        const payload = await googleTasksRequest(`/lists/${encodeURIComponent(taskList.id)}/tasks?${pageParams.toString()}`, { method: 'GET' });
        historyTasks.push(...(payload.items || []));
        historyPageToken = payload.nextPageToken || '';
      } while (historyPageToken && historyTasks.length < GOOGLE_TASK_HISTORY_LIMIT);

      const virtualTasks = createVirtualRecurringGoogleTasks(historyTasks.slice(0, GOOGLE_TASK_HISTORY_LIMIT), taskList, timeMin, timeMax);
      return [...tasks, ...virtualTasks];
    }));
    return batches.flat();
  } catch (error) {
    if (error.statusCode === 403) return [];
    throw error;
  }
}

async function getState() {
  if (useSupabase) {
    const row = await supabaseSingle(
      supabase.from('app_state').select('payload, updated_at').eq('id', 'main').maybeSingle(),
      'select app state',
    );
    if (!row) return null;
    return {
      state: row.payload,
      updatedAt: row.updated_at,
    };
  }
  const selectState = db.prepare('SELECT payload, updated_at FROM app_state WHERE id = ?');
  const row = selectState.get('main');
  if (!row) return null;
  return {
    state: JSON.parse(row.payload),
    updatedAt: row.updated_at,
  };
}

async function saveState(state) {
  const updatedAt = new Date().toISOString();
  if (useSupabase) {
    await supabaseRun(
      supabase.from('app_state').upsert({ id: 'main', payload: state, updated_at: updatedAt }, { onConflict: 'id' }),
      'upsert app state',
    );
    return { state, updatedAt };
  }
  const upsertState = db.prepare(`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  upsertState.run('main', JSON.stringify(state), updatedAt);
  return { state, updatedAt };
}

async function resetState() {
  if (useSupabase) {
    await supabaseRun(supabase.from('app_state').delete().eq('id', 'main'), 'delete app state');
    return;
  }
  db.prepare('DELETE FROM app_state WHERE id = ?').run('main');
}

async function cleanupGoogleOAuthStates(beforeTimestamp) {
  if (useSupabase) {
    await supabaseRun(supabase.from('google_oauth_states').delete().lt('created_at', beforeTimestamp), 'cleanup google oauth states');
    return;
  }
  db.prepare('DELETE FROM google_oauth_states WHERE created_at < ?').run(beforeTimestamp);
}

async function createGoogleOAuthState(state, createdAt) {
  if (useSupabase) {
    await supabaseRun(supabase.from('google_oauth_states').insert({ state, created_at: createdAt }), 'insert google oauth state');
    return;
  }
  db.prepare('INSERT INTO google_oauth_states (state, created_at) VALUES (?, ?)').run(state, createdAt);
}

async function consumeGoogleOAuthState(state) {
  if (useSupabase) {
    const savedState = await supabaseSingle(
      supabase.from('google_oauth_states').select('state').eq('state', state).maybeSingle(),
      'select google oauth state',
    );
    if (savedState) await supabaseRun(supabase.from('google_oauth_states').delete().eq('state', state), 'delete google oauth state');
    return savedState;
  }
  const savedState = db.prepare('SELECT state FROM google_oauth_states WHERE state = ?').get(state);
  if (savedState) db.prepare('DELETE FROM google_oauth_states WHERE state = ?').run(state);
  return savedState;
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      send(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      send(response, 200, { ok: true, storageDriver: STORAGE_DRIVER, dbPath: useSupabase ? null : dbPath });
      return;
    }

    if (url.pathname === '/api/max/status' && request.method === 'GET') {
      const config = getMaxConfig();
      send(response, 200, {
        configured: Boolean(config.botToken && config.reportChatIds.STAVROPOLSKAYA),
        chatIds: {
          STAVROPOLSKAYA: config.reportChatIds.STAVROPOLSKAYA || null,
          MACHUGI: config.reportChatIds.MACHUGI || null,
        },
      });
      return;
    }

    if (url.pathname === '/api/max/reports' && request.method === 'POST') {
      const body = JSON.parse(await readBody(request) || '{}');
      if (!body.slot || !body.report || typeof body.report !== 'object') {
        send(response, 400, { error: 'slot and report are required' });
        return;
      }
      const sentAt = new Date().toISOString();
      const studio = body.report?.studio === 'MACHUGI' ? 'MACHUGI' : 'STAVROPOLSKAYA';
      const message = await sendMaxMessage(maxReportText(body), studio);
      send(response, 200, {
        ok: true,
        sentAt,
        messageId: message.message?.id || message.id || null,
      });
      return;
    }

    if (url.pathname === '/api/google/status' && request.method === 'GET') {
      const config = getGoogleConfig();
      const token = await getGoogleToken();
      let connected = Boolean(token?.refresh_token || token?.access_token);
      let reconnectRequired = false;
      if (connected) {
        try {
          await getGoogleAccessToken();
          const refreshedToken = await getGoogleToken();
          connected = Boolean(refreshedToken?.refresh_token || refreshedToken?.access_token);
        } catch (error) {
          if (error.statusCode === 401 || isInvalidGoogleTokenError(error)) {
            await deleteGoogleToken();
            connected = false;
            reconnectRequired = true;
          } else {
            throw error;
          }
        }
      }
      send(response, 200, {
        configured: Boolean(config.clientId && config.clientSecret),
        connected,
        reconnectRequired,
        calendarId: config.calendarId,
        includeAllCalendars: config.includeAllCalendars,
        includeTasks: config.includeTasks,
        timeZone: config.timeZone,
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
      await cleanupGoogleOAuthStates(Date.now() - 10 * 60 * 1000);
      await createGoogleOAuthState(state, Date.now());
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/tasks.readonly',
      ].join(' '));
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
      const savedState = state ? await consumeGoogleOAuthState(state) : null;
      if (!code || !state || !savedState) {
        redirect(response, `${config.appOrigin}/settings?google=error`);
        return;
      }
      const token = await exchangeGoogleToken({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      });
      await saveGoogleToken(token);
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
      const [calendarEvents, taskEvents] = await Promise.all([
        listGoogleEventsForRange(timeMin, timeMax),
        listGoogleTasksForRange(timeMin, timeMax),
      ]);
      const events = dedupeImportedEvents([...calendarEvents, ...taskEvents])
        .filter((event) => event.date)
        .sort((left, right) => (
          left.date.localeCompare(right.date)
          || (left.startTime || '').localeCompare(right.startTime || '')
          || left.title.localeCompare(right.title)
        ));
      send(response, 200, { events });
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
        body: JSON.stringify(googleEventPayload(body, { includeEmptyRecurrence: true })),
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
      send(response, 200, await getState() ?? { state: null, updatedAt: null });
      return;
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      const body = await readBody(request);
      const parsed = JSON.parse(body || '{}');
      if (!parsed.state || typeof parsed.state !== 'object') {
        send(response, 400, { error: 'state is required' });
        return;
      }
      send(response, 200, await saveState(parsed.state));
      return;
    }

    if (url.pathname === '/api/reset' && request.method === 'POST') {
      await resetState();
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
  console.log(useSupabase ? 'Storage: Supabase' : `SQLite DB: ${dbPath}`);
});
