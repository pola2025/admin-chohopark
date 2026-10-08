import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { synchronize } from './collector-core.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
function envFile(file) { const env = {}; for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } return env; }
const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--once'].includes(mode)) throw Error('INVALID_MODE');
if (process.platform !== 'darwin' || os.userInfo().username !== 'polamini') throw Error('OWNER_MISMATCH');
const env = envFile(path.join(dir, '.env.local'));
const primary = envFile('/Users/polamini/.gjc/ops/env/hermes-migrated.env');
const stateDir = path.resolve(dir, '../../state');
fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
try {
  const result = await synchronize({ env, token: primary.META_ACCESS_TOKEN, config, dryRun: mode !== '--once' });
  const output = mode === '--dry-run' ? { status: result.status, campaigns: result.snapshot.campaigns.length, rows: result.snapshot.rows.length, since: result.snapshot.since, until: result.snapshot.until } : result;
  const tmp = path.join(stateDir, 'last-run.' + process.pid + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(output) + '\n', { mode: 0o600 }); fs.renameSync(tmp, path.join(stateDir, 'last-run.json'));
  console.log(JSON.stringify(output));
} catch (error) {
  const code = /^[A-Z][A-Z0-9_]{1,70}$/.test(error.code || '') ? error.code : 'COLLECTION_FAILED';
  console.error(JSON.stringify({ status: 'FAILED', code, at: new Date().toISOString() })); process.exitCode = 1;
}
