import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ACCOUNT_ID } from '../../src/lib/meta-ads-core.mjs';
import { commitStatements } from './collector-core.mjs';

const campaignId = '120250878150770043';
const here = fileURLToPath(new URL('.', import.meta.url));

function snapshot(collectedAt = '2026-10-08T01:00:00.000Z') {
  return {
    account: { name: 'Choho', currency: 'USD', timezone: 'Asia/Seoul' },
    campaigns: [{ id: campaignId, name: 'Campaign', status: 'ACTIVE', effectiveStatus: 'ACTIVE', objective: 'OUTCOME_LEADS', spendCapCents: null, updatedAt: collectedAt }],
    rows: [{ campaignId, date: '2026-10-08', spendMicros: 1_000_001, impressions: 10, linkClicks: 2, landingPageViews: 1, websiteLeads: 1, dailyReach: 8, sourceJson: '{}', collectedAt }],
    since: '2026-10-01', until: '2026-10-08', collectedAt,
  };
}

test('SQLite schema proves idempotent replacement, rollback, lease guard, and indexed plans', async () => {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const firstRunId = 'run-first';
  const secondRunId = 'run-second';
  const secondStatements = commitStatements(snapshot('2026-10-08T02:00:00.000Z'), secondRunId);
  const rollbackStatements = [...commitStatements(snapshot('2026-10-08T03:00:00.000Z'), 'run-rollback')];
  rollbackStatements.splice(2, 0, { sql: 'INSERT INTO table_that_does_not_exist(value) VALUES(?)', params: ['fail'] });
  const payload = {
    schema, accountId: ACCOUNT_ID, firstRunId, secondRunId,
    firstStatements: commitStatements(snapshot(), firstRunId),
    secondStatements,
    rollbackStatements,
    lostLeaseStatements: commitStatements(snapshot('2026-10-08T04:00:00.000Z'), 'wrong-owner'),
    explain: [
      { sql: 'SELECT date,campaign_id FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=? ORDER BY date DESC,campaign_id ASC LIMIT 32', params: [ACCOUNT_ID, '2026-10-01', '2026-10-08'] },
      { sql: 'SELECT SUM(spend_micros) FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=?', params: [ACCOUNT_ID, '2026-10-01', '2026-10-08'] },
      { sql: 'SELECT d.date,c.name FROM meta_ads_daily d JOIN meta_ads_campaigns c ON c.account_id=d.account_id AND c.campaign_id=d.campaign_id WHERE d.account_id=? AND d.date>=? AND d.date<=? ORDER BY d.date DESC,d.campaign_id ASC LIMIT 32', params: [ACCOUNT_ID, '2026-10-01', '2026-10-08'] },
    ],
  };
  const result = spawnSync('python', [here + 'test-sqlite.py'], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.first, { rows: 1, spend: 1_000_001, version: 1 });
  assert.deepEqual(report.second, { rows: 1, spend: 1_000_001, version: 2 });
  assert.deepEqual({ rows: report.rollback.rows, spend: report.rollback.spend, version: report.rollback.version }, report.second);
  assert.deepEqual({ rows: report.lostLease.rows, spend: report.lostLease.spend, version: report.lostLease.version }, report.second);
  assert.equal(report.lostLease.totalChangesDelta, 0);
  for (const plan of report.plans) {
    assert.match(plan, /idx_meta_ads_daily_account_date|sqlite_autoindex_meta_ads_daily_1/);
    assert.doesNotMatch(plan, /SCAN (?:d|meta_ads_daily)(?:\s|$)/);
  }
});
