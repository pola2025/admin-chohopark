import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_ID, proxyCall } from '../../src/lib/meta-ads-core.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const statements = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8').split(';').map(sql => sql.trim()).filter(Boolean).map(sql => ({ sql, params: [] }));
if (statements.some(s => !/^CREATE (?:TABLE|INDEX) IF NOT EXISTS (?:meta_ads_|idx_meta_ads_)/.test(s.sql))) throw Error('MIGRATION_SCOPE_INVALID');
if (process.argv[2] !== '--apply') { console.log(JSON.stringify({ mode: 'DRY_RUN', creates: statements.length, accountId: ACCOUNT_ID })); }
else {
  const result = await proxyCall(process.env, [...statements, { sql: 'INSERT INTO meta_ads_sync(account_id) VALUES(?) ON CONFLICT(account_id) DO NOTHING', params: [ACCOUNT_ID] }]);
  const readback = await proxyCall(process.env, [
    { sql: "SELECT name,type FROM sqlite_master WHERE name IN ('meta_ads_campaigns','meta_ads_daily','meta_ads_sync','idx_meta_ads_daily_account_date') ORDER BY name", params: [] },
    { sql: 'EXPLAIN QUERY PLAN SELECT date,campaign_id FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=? ORDER BY date DESC,campaign_id ASC LIMIT 32', params: [ACCOUNT_ID, '2026-10-01', '2026-10-31'] },
    { sql: 'EXPLAIN QUERY PLAN SELECT date,spend_micros FROM meta_ads_daily WHERE account_id=? AND campaign_id=? AND date>=? AND date<=? ORDER BY date DESC LIMIT 32', params: [ACCOUNT_ID, '120250878150770043', '2026-10-01', '2026-10-31'] },
  ]);
  console.log(JSON.stringify({ status: 'SCHEMA_READY', statements: result.length, objects: readback[0].results, plans: readback.slice(1).map(x => x.results.map(y => y.detail)) }));
}
