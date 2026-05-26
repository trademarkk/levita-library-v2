import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

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

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sqlitePath = process.env.LEVTIA_SQLITE_PATH || join(rootDir, 'data', 'levtia-library.sqlite');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

if (!existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const db = new DatabaseSync(sqlitePath);
const row = db.prepare('SELECT payload, updated_at FROM app_state WHERE id = ?').get('main');

if (!row?.payload) {
  console.error('No app_state row with id="main" found in SQLite.');
  process.exit(1);
}

const state = JSON.parse(row.payload);
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase
  .from('app_state')
  .upsert({
    id: 'main',
    payload: state,
    updated_at: row.updated_at || new Date().toISOString(),
  }, { onConflict: 'id' });

if (error) {
  console.error(`Supabase upsert failed: ${error.message}`);
  process.exit(1);
}

console.log(`Pushed app_state to Supabase from ${sqlitePath}`);
