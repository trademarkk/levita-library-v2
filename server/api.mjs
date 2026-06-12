import http from 'node:http';
import { createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { readStateFromTables, writeStateToTables } from './table-state.mjs';
import { applyPrismaMutation, closeDuePrismaAdminShifts, createPrisma, readStateFromPrisma, readStateSliceFromPrisma } from './prisma-state.mjs';

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

function tunePrismaDatabaseUrlForServerless() {
  if (!process.env.DATABASE_URL || process.env.LEVTIA_TUNE_PRISMA_POOL === 'false') return;
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '3');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '20');
    process.env.DATABASE_URL = url.toString();
  } catch {
    // Keep the original DATABASE_URL if it cannot be parsed.
  }
}

tunePrismaDatabaseUrlForServerless();

const PORT = Number(process.env.LEVTIA_API_PORT || 4174);
const GOOGLE_REQUEST_TIMEOUT_MS = Number(process.env.GOOGLE_REQUEST_TIMEOUT_MS || 12000);
const GOOGLE_TASK_HISTORY_LIMIT = Number(process.env.GOOGLE_TASK_HISTORY_LIMIT || 500);
const MAX_REQUEST_TIMEOUT_MS = Number(process.env.MAX_REQUEST_TIMEOUT_MS || 12000);
const MAX_API_BASE = process.env.MAX_API_BASE || 'https://platform-api.max.ru';
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || '';
const MAX_REPORT_CHAT_ID = process.env.MAX_REPORT_CHAT_ID || '';
const MAX_REPORT_CHAT_ID_STAVROPOLSKAYA = process.env.MAX_REPORT_CHAT_ID_STAVROPOLSKAYA || MAX_REPORT_CHAT_ID;
const MAX_REPORT_CHAT_ID_MACHUGI = process.env.MAX_REPORT_CHAT_ID_MACHUGI || '';
const MAX_REPORT_REMINDER_SLOTS = ['14:00', '18:00'];
const MAX_REPORT_REPEAT_MINUTES = 15;
const MAX_REMINDER_PROCESSING_TIMEOUT_MINUTES = 5;
const CRON_SECRET = process.env.CRON_SECRET || '';
const MAX_REMINDER_RETENTION_DAYS = Number(process.env.MAX_REMINDER_RETENTION_DAYS || 20);
const APP_STATE_BACKUP_RETENTION_DAYS = Number(process.env.APP_STATE_BACKUP_RETENTION_DAYS || 14);
const APP_STATE_BACKUP_MAX_ROWS = Number(process.env.APP_STATE_BACKUP_MAX_ROWS || 20);
const SESSION_COOKIE_NAME = 'levtia_session';
const SESSION_TTL_MS = Number(process.env.LEVTIA_SESSION_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;
const AUTH_SECRET = process.env.LEVTIA_AUTH_SECRET
  || process.env.CRON_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.MAX_BOT_TOKEN
  || 'levtia-local-dev-session-secret';
const STORAGE_DRIVER = process.env.LEVTIA_STORAGE_DRIVER || 'sqlite';
const DATA_MODE = process.env.LEVTIA_DATA_MODE || 'app_state';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const useSupabase = STORAGE_DRIVER === 'supabase';
const useSupabaseTables = useSupabase && DATA_MODE === 'tables';
const usePrismaState = useSupabase && DATA_MODE === 'prisma';

if (useSupabase && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error('Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

if (!useSupabase) {
  mkdirSync(dataDir, { recursive: true });
}

const DatabaseSync = useSupabase ? null : (await import('node:sqlite')).DatabaseSync;
const db = useSupabase ? null : new DatabaseSync(dbPath);
const prisma = usePrismaState ? createPrisma() : null;
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

    CREATE TABLE IF NOT EXISTS app_state_backups (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      backed_up_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS max_reminders (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      admin_name TEXT NOT NULL,
      studio TEXT NOT NULL CHECK (studio IN ('STAVROPOLSKAYA', 'MACHUGI')),
      report_slot TEXT NOT NULL CHECK (report_slot IN ('14:00', '18:00')),
      scheduled_at TEXT NOT NULL,
      message_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
      sent_at TEXT,
      error TEXT,
      max_message_id TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS max_reminders_status_scheduled_idx
      ON max_reminders (status, scheduled_at);
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

function send(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LEVTIA-SYNC-TOKEN',
    'Access-Control-Allow-Credentials': 'true',
    ...extraHeaders,
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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIntegrationToken(value) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '').trim();
}

function isLevitaCallsAuthorized(request) {
  const expected = normalizeIntegrationToken(process.env.LEVITA_CALLS_SYNC_TOKEN || '');
  if (!expected) return false;
  const incoming = normalizeIntegrationToken(request.headers.authorization || request.headers['x-levtia-sync-token'] || request.headers['x-levita-sync-token'] || '');
  return Boolean(incoming && incoming === expected);
}

function normalizeStudio(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'machugi' || normalized === 'мачуги' || normalized.includes('мачуг')) return 'MACHUGI';
  return 'STAVROPOLSKAYA';
}

function normalizeDateOnly(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const raw = String(value || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function roleRoute(role) {
  return {
    OWNER: '/owner',
    ASSISTANT: '/assistant',
    SENIOR_ADMIN: '/senior-admin',
    ADMIN: '/admin',
    SENIOR_TRAINER: '/senior-trainer',
    TRAINER: '/trainer',
  }[role] || '/login';
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 210_000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !String(storedHash).startsWith('pbkdf2_sha256$')) return false;
  const [, iterationsRaw, salt, expectedHash] = String(storedHash).split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expectedHash) return false;
  const actual = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function publicUser(user) {
  if (!user) return null;
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return buffer.toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function signSessionPayload(encodedPayload) {
  return createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
}

function createSessionToken(user) {
  const payload = base64UrlEncode(JSON.stringify({
    userId: user.id,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  }));
  return `${payload}.${signSessionPayload(payload)}`;
}

function parseCookies(request) {
  const header = request.headers.cookie || '';
  return Object.fromEntries(header.split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=');
      if (index === -1) return [part, ''];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function verifySessionToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = signSessionPayload(payload);
  const incoming = Buffer.from(signature);
  const valid = Buffer.from(expected);
  if (incoming.length !== valid.length || !timingSafeEqual(incoming, valid)) return null;
  try {
    const session = JSON.parse(base64UrlDecode(payload).toString('utf8'));
    if (!session.userId || !session.exp || Number(session.exp) < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function isSecureCookieRequest(request) {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production' || String(request.headers['x-forwarded-proto'] || '').includes('https'));
}

function sessionCookie(token, request) {
  const maxAge = Math.max(0, Math.floor(SESSION_TTL_MS / 1000));
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${isSecureCookieRequest(request) ? '; Secure' : ''}`;
}

function clearSessionCookie(request) {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isSecureCookieRequest(request) ? '; Secure' : ''}`;
}

async function sessionUserFromRequest(request) {
  const token = parseCookies(request)[SESSION_COOKIE_NAME];
  const session = verifySessionToken(token);
  if (!session?.userId) return null;
  const payload = await getState();
  const user = payload?.state?.users?.find((item) => item.id === session.userId) ?? null;
  if (!user || user.status === 'blocked') return null;
  return user;
}

async function requireSessionUser(request) {
  const user = await sessionUserFromRequest(request);
  if (user) return user;
  const error = new Error('Требуется вход в приложение.');
  error.statusCode = 401;
  throw error;
}

function maxStudioName(studio) {
  return studio === 'MACHUGI' ? 'Мачуги' : 'Ставропольская';
}

function maxStudioEnvName(studio) {
  return studio === 'MACHUGI' ? 'MAX_REPORT_CHAT_ID_MACHUGI' : 'MAX_REPORT_CHAT_ID_STAVROPOLSKAYA или MAX_REPORT_CHAT_ID';
}

function resolveMaxChatId(config, studio) {
  return config.reportChatIds[studio] || '';
}

function ensureMaxStudioConfigured(studio = 'STAVROPOLSKAYA') {
  const config = getMaxConfig();
  const reportChatId = resolveMaxChatId(config, studio);
  if (!config.botToken) {
    const error = new Error('MAX не настроен: добавьте MAX_BOT_TOKEN.');
    error.statusCode = 409;
    if (error instanceof TypeError && error.message === 'fetch failed') {
      const networkError = new Error('MAX API недоступен: сетевой запрос не выполнен. Проверьте интернет, токен и доступность API MAX.');
      networkError.statusCode = 502;
      throw networkError;
    }
    throw error;
  }
  if (!reportChatId) {
    const error = new Error(`MAX чат для студии ${maxStudioName(studio)} не настроен: добавьте ${maxStudioEnvName(studio)}.`);
    error.statusCode = 409;
    throw error;
  }
  return { config, reportChatId };
}

function reminderDateTime(date, slot, minutesBefore = 15) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  const [hours, minutes] = String(slot || '').split(':').map(Number);
  if (![year, month, day, hours, minutes].every(Number.isFinite)) return null;
  return new Date(Date.UTC(year, month - 1, day, hours - 3, minutes - minutesBefore, 0, 0));
}

function reportDeadlineDateTime(date, slot) {
  return reminderDateTime(date, slot, 0);
}

function nextPostDeadlineReminderTime(date, slot, fromMs = Date.now()) {
  const deadline = reportDeadlineDateTime(date, slot);
  const dayEnd = reminderDayEnd(date);
  if (!deadline || !dayEnd) return null;

  const intervalMs = MAX_REPORT_REPEAT_MINUTES * 60 * 1000;
  const baseline = Math.max(fromMs, deadline.getTime() + intervalMs);
  const elapsed = baseline - deadline.getTime();
  const steps = Math.max(1, Math.ceil(elapsed / intervalMs));
  const nextTime = new Date(deadline.getTime() + steps * intervalMs);

  if (nextTime.getTime() > dayEnd.getTime()) return null;
  return nextTime;
}

function nextInitialReportReminderTime(date, slot, nowMs = Date.now()) {
  const firstReminder = reminderDateTime(date, slot, 15);
  const deadline = reportDeadlineDateTime(date, slot);
  const dayEnd = reminderDayEnd(date);
  if (!firstReminder || !deadline || !dayEnd || nowMs > dayEnd.getTime()) return null;

  if (nowMs <= firstReminder.getTime()) return firstReminder;
  if (nowMs < deadline.getTime()) return new Date(nowMs);
  return nextPostDeadlineReminderTime(date, slot, nowMs);
}

function maxReminderId(shiftId, date, slot, scheduledAt) {
  return `${shiftId}:${date}:${slot}:${scheduledAt.replace(/[:.]/g, '-')}`;
}

function buildMaxShiftReminder({ shiftId, adminName, studio, date, slot, scheduledAt }) {
  ensureMaxStudioConfigured(studio);
  const scheduledFor = scheduledAt ? new Date(scheduledAt) : reminderDateTime(date, slot);
  if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
    const error = new Error('Некорректная дата или время напоминания.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const scheduledIso = scheduledFor.toISOString();
  return {
    id: maxReminderId(shiftId, date, slot, scheduledIso),
    shiftId,
    adminName,
    studio,
    reportSlot: slot,
    scheduledAt: scheduledIso,
    messageText: `${adminName}, не забудь отчетик на ${slot}💛`,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
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
  const { config, reportChatId } = ensureMaxStudioConfigured(studio);

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
    if (error instanceof TypeError && error.message === 'fetch failed') {
      const networkError = new Error('MAX API недоступен: сетевой запрос не выполнен. Проверьте интернет, токен и доступность API MAX.');
      networkError.statusCode = 502;
      throw networkError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function reminderRowToModel(row) {
  if (!row) return null;
  return {
    id: row.id,
    shiftId: row.shift_id ?? row.shiftId,
    adminName: row.admin_name ?? row.adminName,
    studio: row.studio === 'MACHUGI' ? 'MACHUGI' : 'STAVROPOLSKAYA',
    reportSlot: row.report_slot ?? row.reportSlot,
    scheduledAt: row.scheduled_at ?? row.scheduledAt,
    messageText: row.message_text ?? row.messageText,
    status: row.status,
    sentAt: row.sent_at ?? row.sentAt ?? null,
    error: row.error ?? null,
    maxMessageId: row.max_message_id ?? row.maxMessageId ?? null,
    attempts: Number(row.attempts || 0),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function reminderModelToRow(reminder) {
  return {
    id: reminder.id,
    shift_id: reminder.shiftId,
    admin_name: reminder.adminName,
    studio: reminder.studio,
    report_slot: reminder.reportSlot,
    scheduled_at: reminder.scheduledAt,
    message_text: reminder.messageText,
    status: reminder.status,
    sent_at: reminder.sentAt ?? null,
    error: reminder.error ?? null,
    max_message_id: reminder.maxMessageId ?? null,
    attempts: reminder.attempts ?? 0,
    created_at: reminder.createdAt,
    updated_at: reminder.updatedAt,
  };
}

async function insertMaxReminders(reminders) {
  if (!reminders.length) return [];
  if (useSupabase) {
    await supabaseRun(
      supabase
        .from('max_reminders')
        .upsert(reminders.map(reminderModelToRow), { onConflict: 'id', ignoreDuplicates: true }),
      'upsert max reminders',
    );
    return reminders;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO max_reminders (
      id, shift_id, admin_name, studio, report_slot, scheduled_at, message_text,
      status, sent_at, error, max_message_id, attempts, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const reminder of reminders) {
    const row = reminderModelToRow(reminder);
    insert.run(
      row.id,
      row.shift_id,
      row.admin_name,
      row.studio,
      row.report_slot,
      row.scheduled_at,
      row.message_text,
      row.status,
      row.sent_at,
      row.error,
      row.max_message_id,
      row.attempts,
      row.created_at,
      row.updated_at,
    );
  }
  return reminders;
}

async function deletePendingMaxRemindersForShift(shiftId, slots) {
  const reportSlots = [...new Set((slots || []).filter(Boolean))];
  if (!shiftId || !reportSlots.length) return;

  if (useSupabase) {
    await supabaseRun(
      supabase
        .from('max_reminders')
        .delete()
        .eq('shift_id', shiftId)
        .eq('status', 'pending')
        .in('report_slot', reportSlots),
      'delete pending max reminders for shift',
    );
    return;
  }

  const placeholders = reportSlots.map(() => '?').join(', ');
  db.prepare(`
    DELETE FROM max_reminders
    WHERE shift_id = ?
      AND status = 'pending'
      AND report_slot IN (${placeholders})
  `).run(shiftId, ...reportSlots);
}

function stateDateKey(value) {
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value || ''))) return String(value).slice(0, 10);
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isReminderReportSubmitted(reminder, appState) {
  const shift = (appState?.adminShifts || []).find((item) => item.id === reminder.shiftId);
  const checklist = (appState?.checklists || []).find((item) => (
    item.assignedTo === shift?.userId
    && stateDateKey(item.date) === shift?.date
  ));
  const report = checklist?.reports?.find((item) => item.slot === reminder.reportSlot);
  return Boolean(report?.submittedAt || report?.sentToMax || report?.maxSentAt);
}

function reminderDayEnd(date) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(Date.UTC(year, month - 1, day, 20, 59, 59, 999));
}

function nextFollowUpReminder(reminder) {
  const shiftDate = reminder.shiftId ? reminder.id.split(':')[1] : '';
  const date = shiftDate || String(reminder.scheduledAt || '').slice(0, 10);
  const nextTime = nextPostDeadlineReminderTime(date, reminder.reportSlot);
  if (!nextTime) return null;
  return buildMaxShiftReminder({
    shiftId: reminder.shiftId,
    adminName: reminder.adminName,
    studio: reminder.studio,
    date,
    slot: reminder.reportSlot,
    scheduledAt: nextTime.toISOString(),
  });
}

async function createMaxShiftReminders(input) {
  const studio = input.studio === 'MACHUGI' ? 'MACHUGI' : 'STAVROPOLSKAYA';
  ensureMaxStudioConfigured(studio);
  const now = Date.now();
  const reminders = MAX_REPORT_REMINDER_SLOTS
    .map((slot) => {
      const scheduledAt = nextInitialReportReminderTime(input.date, slot, now);
      if (!scheduledAt) return null;
      return buildMaxShiftReminder({ ...input, studio, slot, scheduledAt: scheduledAt.toISOString() });
    })
    .filter(Boolean);
  await deletePendingMaxRemindersForShift(input.shiftId, reminders.map((reminder) => reminder.reportSlot));
  await insertMaxReminders(reminders);
  return reminders.map((reminder) => ({
    slot: reminder.reportSlot,
    scheduledFor: reminder.scheduledAt,
    status: reminder.status,
  }));
}

async function claimDueMaxReminders(limit = 25) {
  const now = new Date().toISOString();
  if (useSupabase) {
    const { data, error } = await supabase
      .from('max_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Supabase select max reminders failed: ${error.message}`);
    const claimed = [];
    for (const row of data || []) {
      const reminder = reminderRowToModel(row);
      const { data: updated, error: updateError } = await supabase
        .from('max_reminders')
        .update({ status: 'processing', attempts: reminder.attempts + 1, updated_at: now })
        .eq('id', reminder.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();
      if (updateError) throw new Error(`Supabase claim max reminder failed: ${updateError.message}`);
      if (updated) claimed.push(reminderRowToModel(updated));
    }
    return claimed;
  }

  const rows = db.prepare(`
    SELECT * FROM max_reminders
    WHERE status = 'pending' AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
    LIMIT ?
  `).all(now, limit);
  const reminders = rows.map(reminderRowToModel);
  const claim = db.prepare(`
    UPDATE max_reminders
    SET status = 'processing', attempts = attempts + 1, updated_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  return reminders.filter((reminder) => claim.run(now, reminder.id).changes > 0);
}

async function releaseStaleProcessingMaxReminders() {
  const cutoff = new Date(Date.now() - MAX_REMINDER_PROCESSING_TIMEOUT_MINUTES * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  if (useSupabase) {
    const { data, error } = await supabase
      .from('max_reminders')
      .update({ status: 'pending', error: 'processing timeout: returned to queue', updated_at: now })
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
      .select('id');
    if (error) throw new Error(`Supabase release stale max reminders failed: ${error.message}`);
    return { released: data?.length ?? 0, cutoff };
  }

  const result = db.prepare(`
    UPDATE max_reminders
    SET status = 'pending', error = 'processing timeout: returned to queue', updated_at = ?
    WHERE status = 'processing' AND updated_at < ?
  `).run(now, cutoff);
  return { released: result.changes ?? 0, cutoff };
}

async function markMaxReminderSent(id, messageId) {
  const now = new Date().toISOString();
  if (useSupabase) {
    await supabaseRun(
      supabase
        .from('max_reminders')
        .update({ status: 'sent', sent_at: now, error: null, max_message_id: messageId || null, updated_at: now })
        .eq('id', id),
      'mark max reminder sent',
    );
    return;
  }
  db.prepare(`
    UPDATE max_reminders
    SET status = 'sent', sent_at = ?, error = NULL, max_message_id = ?, updated_at = ?
    WHERE id = ?
  `).run(now, messageId || null, now, id);
}

async function markMaxReminderFailed(id, errorMessage) {
  const now = new Date().toISOString();
  if (useSupabase) {
    await supabaseRun(
      supabase
        .from('max_reminders')
        .update({ status: 'failed', error: errorMessage, updated_at: now })
        .eq('id', id),
      'mark max reminder failed',
    );
    return;
  }
  db.prepare(`
    UPDATE max_reminders
    SET status = 'failed', error = ?, updated_at = ?
    WHERE id = ?
  `).run(errorMessage, now, id);
}

function maxReminderCleanupCutoff() {
  const days = Number.isFinite(MAX_REMINDER_RETENTION_DAYS) && MAX_REMINDER_RETENTION_DAYS > 0
    ? MAX_REMINDER_RETENTION_DAYS
    : 20;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function cleanupOldMaxReminders() {
  const cutoff = maxReminderCleanupCutoff();
  if (useSupabase) {
    const { data, error } = await supabase
      .from('max_reminders')
      .delete()
      .in('status', ['sent', 'failed'])
      .lt('scheduled_at', cutoff)
      .select('id');
    if (error) throw new Error(`Supabase cleanup max reminders failed: ${error.message}`);
    return { deleted: data?.length ?? 0, cutoff };
  }

  const result = db.prepare(`
    DELETE FROM max_reminders
    WHERE status IN ('sent', 'failed') AND scheduled_at < ?
  `).run(cutoff);
  return { deleted: result.changes ?? 0, cutoff };
}

function moscowCloseDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

async function closeDueAdminShifts() {
  if (usePrismaState) return closeDuePrismaAdminShifts(prisma);
  const current = moscowCloseDateParts();
  if (current.hour < 23) {
    return { ok: true, skipped: true, reason: 'before-23-msk', closed: 0, date: current.date };
  }
  const stored = await getState();
  const state = stored?.state;
  if (!state) return { ok: true, skipped: false, closed: 0, date: current.date };
  const closedAt = new Date().toISOString();
  let closed = 0;
  const adminShifts = (state.adminShifts || []).map((shift) => {
    if (shift.closedAt || shift.date > current.date) return shift;
    closed += 1;
    return { ...shift, closedAt };
  });
  await saveState({ ...state, adminShifts });
  return { ok: true, skipped: false, closed, date: current.date, closedAt };
}

async function createDatabaseBackup() {
  const stored = await getState();
  const state = stored?.state || null;
  if (!state) return { ok: false, error: 'State is empty.' };
  const id = randomUUID();
  const backedUpAt = new Date().toISOString();
  if (usePrismaState) {
    await prisma.$executeRaw`
      insert into public.app_state_backups (id, state_id, payload, backed_up_at)
      values (${id}::uuid, 'prisma-snapshot', ${JSON.stringify(state)}::jsonb, ${backedUpAt}::timestamptz)
    `;
    await cleanupAppStateBackups(backedUpAt, 'prisma-snapshot');
    return { ok: true, id, backedUpAt, mode: 'prisma' };
  }
  if (useSupabase) {
    await supabaseRun(
      supabase.from('app_state_backups').insert({
        id,
        state_id: 'snapshot',
        payload: state,
        backed_up_at: backedUpAt,
      }),
      'create app state backup',
    );
    await cleanupAppStateBackups(backedUpAt, 'snapshot');
    return { ok: true, id, backedUpAt, mode: 'supabase' };
  }
  db.prepare('INSERT INTO app_state_backups (id, state_id, payload, backed_up_at) VALUES (?, ?, ?, ?)').run(id, 'snapshot', JSON.stringify(state), backedUpAt);
  await cleanupAppStateBackups(backedUpAt, 'snapshot');
  return { ok: true, id, backedUpAt, mode: 'sqlite' };
}

async function runMaxReminderJob() {
  const released = await releaseStaleProcessingMaxReminders();
  const reminders = await claimDueMaxReminders();
  const storedState = reminders.length ? await getState() : null;
  const appState = storedState?.state || null;
  const results = [];
  for (const reminder of reminders) {
    try {
      if (!MAX_REPORT_REMINDER_SLOTS.includes(reminder.reportSlot)) {
        await markMaxReminderSent(reminder.id, 'skipped-disabled-slot');
        results.push({ id: reminder.id, status: 'skipped', reason: 'disabled-slot' });
        continue;
      }
      if (isReminderReportSubmitted(reminder, appState)) {
        await markMaxReminderSent(reminder.id, 'skipped-report-submitted');
        results.push({ id: reminder.id, status: 'skipped', reason: 'report-submitted' });
        continue;
      }
      const message = await sendMaxMessage(reminder.messageText, reminder.studio);
      const messageId = message.message?.id || message.id || null;
      await markMaxReminderSent(reminder.id, messageId);
      const nextReminder = isReminderReportSubmitted(reminder, appState) ? null : nextFollowUpReminder(reminder);
      if (nextReminder) await insertMaxReminders([nextReminder]);
      results.push({ id: reminder.id, status: 'sent', messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown MAX reminder error';
      await markMaxReminderFailed(reminder.id, message);
      const nextReminder = isReminderReportSubmitted(reminder, appState) ? null : nextFollowUpReminder(reminder);
      if (nextReminder) await insertMaxReminders([nextReminder]);
      results.push({ id: reminder.id, status: 'failed', error: message });
    }
  }
  const cleanup = await cleanupOldMaxReminders();
  return {
    ok: true,
    processed: results.length,
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    releasedStaleProcessing: released.released,
    cleanup,
    results,
  };
}

function isCronAuthorized(request, url) {
  if (!CRON_SECRET) return true;
  const header = request.headers.authorization || request.headers.Authorization || '';
  return header === `Bearer ${CRON_SECRET}` || url.searchParams.get('secret') === CRON_SECRET;
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

export async function getState() {
  if (usePrismaState) return readStateFromPrisma(prisma);
  if (useSupabaseTables) return readStateFromTables(supabase);
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

async function getStateSlice(slice, params = {}) {
  if (usePrismaState) return readStateSliceFromPrisma(prisma, slice, params);
  const payload = await getState();
  const state = payload?.state || {};
  const month = String(params.month || '').slice(0, 7);
  const pickMonth = (date) => !month || String(date || '').slice(0, 7) === month;
  const sliceState = {};

  if (slice === 'bootstrap' || slice === 'team') Object.assign(sliceState, { users: state.users || [], settings: state.settings });
  else if (slice === 'tasks') Object.assign(sliceState, { tasks: state.tasks || [] });
  else if (slice === 'content') Object.assign(sliceState, {
    knowledge: state.knowledge || [],
    templates: state.templates || [],
    links: state.links || [],
    documentTemplates: state.documentTemplates || [],
    usefulContacts: state.usefulContacts || [],
    favorites: state.favorites || [],
    readReceipts: state.readReceipts || [],
  });
  else if (slice === 'checklists' || slice === 'control') Object.assign(sliceState, {
    users: state.users || [],
    checklists: state.checklists || [],
    adminShifts: state.adminShifts || [],
    refunds: state.refunds || [],
    tasks: state.tasks || [],
  });
  else if (slice === 'financial-plan') Object.assign(sliceState, { financialPlans: (state.financialPlans || []).filter((plan) => !month || plan.month === month) });
  else if (slice === 'expenses') Object.assign(sliceState, { expenseCategories: state.expenseCategories || [], expenses: (state.expenses || []).filter((expense) => pickMonth(expense.date)) });
  else if (slice === 'ratings') Object.assign(sliceState, { trainerEvaluations: (state.trainerEvaluations || []).filter((item) => pickMonth(item.evaluatedAt)), callReviews: (state.callReviews || []).filter((item) => pickMonth(item.reviewedAt)) });
  else if (slice === 'trainer-hiring') Object.assign(sliceState, { trainerHiringCandidates: state.trainerHiringCandidates || [] });
  else if (slice === 'audit') Object.assign(sliceState, { auditLog: state.auditLog || [] });
  else if (slice === 'refunds') Object.assign(sliceState, { refunds: state.refunds || [] });
  else {
    const error = new Error(`Unknown state slice: ${slice}`);
    error.statusCode = 400;
    throw error;
  }

  return { updatedAt: payload?.updatedAt || new Date().toISOString(), state: sliceState, sliceMeta: month ? { month } : undefined };
}

export async function saveState(state) {
  if (usePrismaState) {
    const error = new Error('Direct full-state writes are disabled in Prisma mode. Use /api/mutations for targeted writes.');
    error.statusCode = 409;
    throw error;
  }
  const updatedAt = new Date().toISOString();
  const existing = await getState();
  const stateToSave = prepareStateForStorage(state, existing?.state);
  if (useSupabaseTables) {
    const result = await writeStateToTables(supabase, stateToSave);
    return { state: sanitizeStateForClient(result.state), updatedAt: result.updatedAt };
  }
  if (useSupabase) {
    if (existing?.state) {
      await supabaseRun(
        supabase.from('app_state_backups').insert({
          id: randomUUID(),
          state_id: 'main',
          payload: existing.state,
          backed_up_at: updatedAt,
        }),
        'backup app state',
      );
      await cleanupAppStateBackups(updatedAt);
    }
    await supabaseRun(
      supabase.from('app_state').upsert({ id: 'main', payload: stateToSave, updated_at: updatedAt }, { onConflict: 'id' }),
      'upsert app state',
    );
    return { state: sanitizeStateForClient(stateToSave), updatedAt };
  }
  const upsertState = db.prepare(`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  if (existing?.state) {
    db.prepare(`
      INSERT INTO app_state_backups (id, state_id, payload, backed_up_at)
      VALUES (?, ?, ?, ?)
    `).run(randomUUID(), 'main', JSON.stringify(existing.state), updatedAt);
    await cleanupAppStateBackups(updatedAt);
  }
  upsertState.run('main', JSON.stringify(stateToSave), updatedAt);
  return { state: sanitizeStateForClient(stateToSave), updatedAt };
}

async function cleanupAppStateBackups(nowIso = new Date().toISOString(), stateId = 'main') {
  const cutoff = new Date(new Date(nowIso).getTime() - APP_STATE_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  if (useSupabase) {
    await supabaseRun(supabase.from('app_state_backups').delete().eq('state_id', stateId).lt('backed_up_at', cutoff), 'cleanup old app state backups');
    if (APP_STATE_BACKUP_MAX_ROWS > 0) {
      const { data, error } = await supabase
        .from('app_state_backups')
        .select('id')
        .eq('state_id', stateId)
        .order('backed_up_at', { ascending: false })
        .range(APP_STATE_BACKUP_MAX_ROWS, APP_STATE_BACKUP_MAX_ROWS + 500);
      if (error) throw new Error(`Supabase select extra app state backups failed: ${error.message}`);
      const ids = (data || []).map((row) => row.id);
      if (ids.length) await supabaseRun(supabase.from('app_state_backups').delete().in('id', ids), 'cleanup extra app state backups');
    }
    return;
  }
  db.prepare('DELETE FROM app_state_backups WHERE state_id = ? AND backed_up_at < ?').run(stateId, cutoff);
  if (APP_STATE_BACKUP_MAX_ROWS > 0) {
    db.prepare(`
      DELETE FROM app_state_backups
      WHERE id IN (
        SELECT id FROM app_state_backups
        WHERE state_id = ?
        ORDER BY backed_up_at DESC
        LIMIT -1 OFFSET ?
      )
    `).run('main', APP_STATE_BACKUP_MAX_ROWS);
  }
}

function prepareStateForStorage(state, existingState = null) {
  if (!state || typeof state !== 'object') return state;
  const existingHashes = new Map((existingState?.users || []).map((user) => [user.id, user.passwordHash]));
  const knownEntities = new Set([
    ...(state.knowledge || []).map((item) => `knowledge:${item.id}`),
    ...(state.templates || []).map((item) => `template:${item.id}`),
    ...(state.links || []).map((item) => `link:${item.id}`),
    ...(state.documentTemplates || []).map((item) => `documentTemplate:${item.id}`),
    ...(state.usefulContacts || []).map((item) => `usefulContact:${item.id}`),
  ]);
  const knownUsers = new Set((state.users || []).map((user) => user.id));
  return {
    ...state,
    schemaVersion: Math.max(Number(state.schemaVersion) || 0, 2),
    users: (state.users || []).map((user) => {
      const password = String(user.password || '');
      const passwordHash = user.passwordHash || existingHashes.get(user.id) || (password ? hashPassword(password) : undefined);
      const { password: _password, ...safeUser } = user;
      return passwordHash ? { ...safeUser, passwordHash } : safeUser;
    }),
    favorites: (state.favorites || []).filter((favorite) => knownUsers.has(favorite.userId) && knownEntities.has(`${favorite.entityType}:${favorite.entityId}`)),
    readReceipts: (state.readReceipts || []).filter((receipt) => knownUsers.has(receipt.userId) && receipt.entityType === 'knowledge' && knownEntities.has(`knowledge:${receipt.entityId}`)),
    auditLog: (state.auditLog || []).slice(0, 500),
  };
}

function sanitizeStateForClient(state) {
  if (!state || typeof state !== 'object') return state;
  return {
    ...state,
    users: (state.users || []).map(publicUser),
  };
}

function callReviewFromPayload(body, existingReview = null) {
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const externalId = String(body.externalId || payload.externalId || payload.callId || payload.id || '').trim();
  const now = new Date().toISOString();
  const score = Number(payload.score ?? payload.totalScore ?? payload.total_score);
  return {
    id: existingReview?.id || randomUUID(),
    source: 'levita-calls',
    externalId,
    adminName: String(payload.adminName || payload.admin_name || payload.managerName || '').trim(),
    studio: normalizeStudio(payload.studio || payload.studioSlug || payload.studio_slug || payload.studioName || payload.studio_name),
    score: Number.isFinite(score) ? score : 0,
    reviewedAt: normalizeDateOnly(payload.reviewedAt || payload.reviewed_at || payload.callDate || payload.createdAt || payload.created_at),
    amoCrmDealUrl: payload.amoCrmDealUrl || payload.amo_crm_deal_url || payload.amoUrl || null,
    callUrl: payload.callUrl || payload.call_url || null,
    originalFilename: payload.originalFilename || payload.original_filename || null,
    comment: payload.comment || payload.summary || payload.notes || null,
    createdAt: existingReview?.createdAt || now,
    updatedAt: now,
  };
}

async function syncLevitaCallReview(body) {
  const event = String(body.event || body.type || 'updated').trim().toLowerCase();
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const externalId = String(body.externalId || payload.externalId || payload.callId || payload.id || '').trim();
  if (!externalId) {
    const error = new Error('externalId is required');
    error.statusCode = 400;
    throw error;
  }

  const stored = await getState();
  const state = stored?.state;
  if (!state) {
    const error = new Error('App state is not initialized');
    error.statusCode = 409;
    throw error;
  }

  if (event === 'deleted' || event === 'delete') {
    if (usePrismaState) {
      await applyPrismaMutation(prisma, 'callReview.delete', { externalId });
      const next = await getState();
      return { ok: true, event, externalId, deleted: true, callReviewsCount: next?.state?.callReviews?.length || 0, updatedAt: next?.updatedAt || new Date().toISOString() };
    }
    const callReviews = (state.callReviews || []).filter((review) => !(review.source === 'levita-calls' && review.externalId === externalId));
    const result = await saveState({ ...state, callReviews });
    return { ok: true, event, externalId, deleted: true, callReviewsCount: callReviews.length, updatedAt: result.updatedAt };
  }

  const scoreValue = Number(payload.score ?? payload.totalScore ?? payload.total_score);
  const existingReviews = Array.isArray(state.callReviews) ? state.callReviews : [];
  const existing = existingReviews.find((review) => review.source === 'levita-calls' && review.externalId === externalId);
  const review = callReviewFromPayload({ ...body, externalId }, existing);
    if (!review.adminName || !Number.isFinite(scoreValue)) {
      const error = new Error('adminName and score are required');
      error.statusCode = 400;
      throw error;
    }

  if (usePrismaState) {
    await applyPrismaMutation(prisma, 'callReview.upsert', review);
    const next = await getState();
    return { ok: true, event, externalId, deleted: false, callReviewsCount: next?.state?.callReviews?.length || 0, updatedAt: next?.updatedAt || new Date().toISOString() };
  }

  const callReviews = existing
    ? existingReviews.map((item) => (item.id === existing.id ? review : item))
    : [review, ...existingReviews];
  const result = await saveState({ ...state, callReviews });
  return {
    ok: true,
    event,
    externalId,
    deleted: event === 'deleted' || event === 'delete',
    callReviewsCount: callReviews.length,
    updatedAt: result.updatedAt,
  };
}

async function resetState() {
  if (usePrismaState) {
    const tables = [
      ['financial_plan_payments', 'row_id'],
      ['checklist_reports', 'id'],
      ['checklist_items', 'id'],
      ['financial_plan_rows', 'id'],
      ['daily_checklists', 'id'],
      ['admin_shifts', 'id'],
      ['audit_log', 'id'],
      ['call_reviews', 'id'],
      ['tasks', 'id'],
      ['response_templates', 'id'],
      ['helpful_links', 'id'],
      ['document_templates', 'id'],
      ['useful_contacts', 'id'],
      ['knowledge_entries', 'id'],
      ['content_favorites', 'id'],
      ['content_read_receipts', 'id'],
      ['refunds', 'id'],
      ['financial_plan_months', 'month'],
      ['calendar_events', 'id'],
      ['expense_categories', 'id'],
      ['expenses', 'id'],
      ['trainer_evaluation_sheets', 'id'],
      ['trainer_hiring_candidates', 'id'],
      ['call_checklist_items', 'id'],
      ['app_settings', 'id'],
      ['users', 'id'],
    ];
    for (const [table, column] of tables) {
      await prisma.$executeRawUnsafe(`delete from public.${table} where ${column} is not null`);
    }
    return;
  }
  if (useSupabaseTables) {
    const tables = [
      ['financial_plan_payments', 'row_id'],
      ['checklist_reports', 'id'],
      ['checklist_items', 'id'],
      ['financial_plan_rows', 'id'],
      ['daily_checklists', 'id'],
      ['admin_shifts', 'id'],
      ['audit_log', 'id'],
      ['call_reviews', 'id'],
      ['tasks', 'id'],
      ['response_templates', 'id'],
      ['helpful_links', 'id'],
      ['document_templates', 'id'],
      ['useful_contacts', 'id'],
      ['knowledge_entries', 'id'],
      ['content_favorites', 'id'],
      ['content_read_receipts', 'id'],
      ['refunds', 'id'],
      ['financial_plan_months', 'month'],
      ['calendar_events', 'id'],
      ['expense_categories', 'id'],
      ['expenses', 'id'],
      ['trainer_evaluation_sheets', 'id'],
      ['trainer_hiring_candidates', 'id'],
      ['call_checklist_items', 'id'],
      ['app_settings', 'id'],
      ['users', 'id'],
    ];
    for (const [table, column] of tables) {
      await supabaseRun(supabase.from(table).delete().not(column, 'is', null), `reset ${table}`);
    }
    return;
  }
  if (useSupabase) {
    await supabaseRun(supabase.from('app_state').delete().eq('id', 'main'), 'delete app state');
    return;
  }
  db.prepare('DELETE FROM app_state WHERE id = ?').run('main');
}

async function readMutationActor(actorId) {
  if (!actorId) return null;
  if (usePrismaState) {
    const rows = await prisma.$queryRaw`
      select id, name, role
      from public.users
      where id = ${actorId}
      limit 1
    `;
    const row = rows[0];
    return row ? { id: row.id, name: row.name, role: row.role } : null;
  }
  const current = await getState();
  return current?.state?.users?.find((user) => user.id === actorId) ?? null;
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

export async function handleApiRequest(request, response) {
  try {
    if (request.method === 'OPTIONS') {
      send(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      send(response, 200, { ok: true, storageDriver: STORAGE_DRIVER, dataMode: DATA_MODE, dbPath: useSupabase ? null : dbPath });
      return;
    }

    if (url.pathname === '/api/max/status' && request.method === 'GET') {
      await requireSessionUser(request);
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

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const user = await sessionUserFromRequest(request);
      if (!user) {
        send(response, 401, { error: 'Требуется вход в приложение.' }, { 'Set-Cookie': clearSessionCookie(request) });
        return;
      }
      send(response, 200, { ok: true, user: publicUser(user), route: roleRoute(user.role) });
      return;
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = JSON.parse(await readBody(request) || '{}');
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      if (!email || !password.trim()) {
        send(response, 400, { error: 'Введите email и пароль.' });
        return;
      }

      const payload = await getState();
      const state = payload?.state;
      const user = state?.users?.find((item) => normalizeEmail(item.email) === email);
      if (!user) {
        send(response, 404, { error: 'Пользователь с таким email не найден.' });
        return;
      }
      if (user.status === 'blocked') {
        send(response, 403, { error: 'Доступ сотрудника заблокирован.' });
        return;
      }

      const hashOk = verifyPassword(password, user.passwordHash);
      const legacyOk = !user.passwordHash && user.password && user.password === password;
      if (!hashOk && !legacyOk) {
        send(response, 401, { error: 'Неверный пароль.' });
        return;
      }

      if (legacyOk) {
        if (usePrismaState) {
          await applyPrismaMutation(prisma, 'employee.update', { id: user.id, input: { password } }, user);
          const nextUser = { ...user, password: '', passwordHash: hashPassword(password) };
          send(response, 200, { ok: true, user: publicUser(nextUser), route: roleRoute(user.role) }, { 'Set-Cookie': sessionCookie(createSessionToken(nextUser), request) });
          return;
        }
        const nextState = {
          ...state,
          users: state.users.map((item) => item.id === user.id
            ? { ...item, password: '', passwordHash: hashPassword(password) }
            : item),
        };
        await saveState(nextState);
      }

      send(response, 200, { ok: true, user: publicUser(user), route: roleRoute(user.role) }, { 'Set-Cookie': sessionCookie(createSessionToken(user), request) });
      return;
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      send(response, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(request) });
      return;
    }

    if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
      const body = JSON.parse(await readBody(request) || '{}');
      const email = normalizeEmail(body.email);
      const password = String(body.password || '').trim();
      if (!email || !password) {
        send(response, 400, { error: 'Введите email и новый пароль.' });
        return;
      }
      if (password.length < 6) {
        send(response, 400, { error: 'Пароль должен быть не короче 6 символов.' });
        return;
      }

      const payload = await getState();
      const state = payload?.state;
      const user = state?.users?.find((item) => normalizeEmail(item.email) === email);
      if (!user) {
        send(response, 404, { error: 'Пользователь с таким email не найден.' });
        return;
      }

      const nextState = {
        ...state,
        users: state.users.map((item) => item.id === user.id
          ? { ...item, password: '', passwordHash: hashPassword(password) }
          : item),
      };
      if (usePrismaState) await applyPrismaMutation(prisma, 'employee.update', { id: user.id, input: { password } }, user);
      else await saveState(nextState);
      send(response, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/max/shift-reminders' && request.method === 'POST') {
      await requireSessionUser(request);
      const body = JSON.parse(await readBody(request) || '{}');
      if (!body.shiftId || !body.adminName || !body.date) {
        send(response, 400, { error: 'shiftId, adminName and date are required' });
        return;
      }
      const scheduled = await createMaxShiftReminders({
        shiftId: body.shiftId,
        adminName: body.adminName,
        studio: body.studio,
        date: body.date,
      });
      send(response, 200, { ok: true, scheduled });
      return;
    }

    if (url.pathname === '/api/jobs/max-reminders' && (request.method === 'GET' || request.method === 'POST')) {
      if (!isCronAuthorized(request, url)) {
        send(response, 401, { error: 'Unauthorized cron request' });
        return;
      }
      send(response, 200, await runMaxReminderJob());
      return;
    }

    if (url.pathname === '/api/jobs/close-shifts' && (request.method === 'GET' || request.method === 'POST')) {
      if (!isCronAuthorized(request, url)) {
        send(response, 401, { error: 'Unauthorized cron request' });
        return;
      }
      send(response, 200, await closeDueAdminShifts());
      return;
    }

    if (url.pathname === '/api/jobs/backup' && (request.method === 'GET' || request.method === 'POST')) {
      if (!isCronAuthorized(request, url)) {
        send(response, 401, { error: 'Unauthorized cron request' });
        return;
      }
      send(response, 200, await createDatabaseBackup());
      return;
    }

    if (url.pathname === '/api/max/reports' && request.method === 'POST') {
      await requireSessionUser(request);
      const body = JSON.parse(await readBody(request) || '{}');
      if (!body.slot || !body.report || typeof body.report !== 'object') {
        send(response, 400, { error: 'slot and report are required' });
        return;
      }
      if (!MAX_REPORT_REMINDER_SLOTS.includes(body.slot)) {
        send(response, 400, { error: 'Reports are available only for 14:00 and 18:00' });
        return;
      }
      const requiredReportFields = ['adminName', 'calls', 'reached', 'bookings', 'cash', 'came', 'bought'];
      const missingReportField = requiredReportFields.some((field) => !String(body.report?.[field] ?? '').trim());
      if (missingReportField) {
        send(response, 400, { error: 'Заполните все поля отчёта перед отправкой в MAX.' });
        return;
      }
      const sentAt = new Date().toISOString();
      const studio = body.report?.studio === 'MACHUGI' ? 'MACHUGI' : 'STAVROPOLSKAYA';
      try {
        const message = await sendMaxMessage(maxReportText(body), studio);
        send(response, 200, {
          ok: true,
          sentAt,
          messageId: message.message?.id || message.id || null,
        });
      } catch (error) {
        send(response, 200, {
          ok: false,
          sentAt: null,
          messageId: null,
          error: error instanceof Error ? error.message : 'MAX report was not sent.',
        });
      }
      return;
    }

    if (url.pathname === '/api/integrations/levita-calls/reviews' && request.method === 'POST') {
      if (!isLevitaCallsAuthorized(request)) {
        send(response, 401, { error: 'Unauthorized levita-calls sync request' });
        return;
      }
      const body = JSON.parse(await readBody(request) || '{}');
      send(response, 200, await syncLevitaCallReview(body));
      return;
    }

    if (url.pathname === '/api/mutations' && request.method === 'POST') {
      if (!usePrismaState) {
        send(response, 409, { error: 'Prisma mutations require LEVTIA_DATA_MODE=prisma.' });
        return;
      }
      const body = JSON.parse(await readBody(request) || '{}');
      if (!body.action || typeof body.action !== 'string') {
        send(response, 400, { error: 'action is required' });
        return;
      }
      const actor = await requireSessionUser(request);
      await applyPrismaMutation(prisma, body.action, body.payload || {}, actor);
      if (body.returnState === false) {
        send(response, 200, { ok: true, state: null, updatedAt: new Date().toISOString(), skipRefresh: true });
        return;
      }
      const payload = await getState();
      send(response, 200, payload ? { ...payload, state: sanitizeStateForClient(payload.state) } : { state: null, updatedAt: null });
      return;
    }

    if (url.pathname === '/api/google/status' && request.method === 'GET') {
      await requireSessionUser(request);
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
      await requireSessionUser(request);
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
      await requireSessionUser(request);
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
      await requireSessionUser(request);
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
      await requireSessionUser(request);
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
      await requireSessionUser(request);
      const googleEventId = decodeURIComponent(url.pathname.replace('/api/google/events/', ''));
      if (googleEventId) {
        await googleCalendarRequest(`/events/${encodeURIComponent(googleEventId)}`, { method: 'DELETE' });
      }
      send(response, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/state' && request.method === 'GET') {
      await requireSessionUser(request);
      const payload = await getState();
      send(response, 200, payload ? { ...payload, state: sanitizeStateForClient(payload.state) } : { state: null, updatedAt: null });
      return;
    }

    if (url.pathname === '/api/state-slice' && request.method === 'GET') {
      await requireSessionUser(request);
      const slice = url.searchParams.get('slice') || '';
      const month = url.searchParams.get('month') || undefined;
      const payload = await getStateSlice(slice, { month });
      send(response, 200, payload ? { ...payload, state: sanitizeStateForClient(payload.state) } : { state: null, updatedAt: null });
      return;
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      await requireSessionUser(request);
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
      await requireSessionUser(request);
      await resetState();
      send(response, 200, { ok: true });
      return;
    }

    send(response, 404, { error: 'Not found' });
  } catch (error) {
    send(response, error.statusCode || 500, { error: error instanceof Error ? error.message : 'Unknown server error' });
  }
}

const server = http.createServer(handleApiRequest);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`LEVTIA Library API: http://127.0.0.1:${PORT}`);
    console.log(useSupabase ? 'Storage: Supabase' : `SQLite DB: ${dbPath}`);
  });
  if (process.env.MAX_REMINDER_LOCAL_CRON !== 'false') {
    setInterval(() => {
      runMaxReminderJob().catch((error) => {
        console.error('MAX reminder job failed:', error);
      });
    }, 60 * 1000).unref();
  }
}

