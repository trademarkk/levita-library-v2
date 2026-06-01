import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from('app_state')
  .select('payload, updated_at')
  .eq('id', 'main')
  .maybeSingle();

if (error) {
  console.error(`Supabase select app_state failed: ${error.message}`);
  process.exit(1);
}

if (!data?.payload) {
  console.error('No app_state row with id="main" found in Supabase.');
  process.exit(1);
}

process.env.LEVTIA_STORAGE_DRIVER = 'supabase';
process.env.LEVTIA_DATA_MODE = 'tables';

const { saveState, getState } = await import('../server/api.mjs');
await saveState(data.payload);
const migrated = await getState();
const state = migrated?.state || {};

console.log(JSON.stringify({
  ok: true,
  sourceUpdatedAt: data.updated_at,
  users: state.users?.length ?? 0,
  knowledge: state.knowledge?.length ?? 0,
  templates: state.templates?.length ?? 0,
  links: state.links?.length ?? 0,
  checklists: state.checklists?.length ?? 0,
  trainerEvaluations: state.trainerEvaluations?.length ?? 0,
  callReviews: state.callReviews?.length ?? 0,
}, null, 2));
