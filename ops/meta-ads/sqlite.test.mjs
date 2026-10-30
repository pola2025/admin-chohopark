import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ACCOUNT_ID } from '../../src/lib/meta-ads-core.mjs';
import { commitStatements } from './collector-core.mjs';

const campaignId = '120250878150770043';
const otherCampaignId = '120299999999999999';
const here = fileURLToPath(new URL('.', import.meta.url));
let sqlite; try { sqlite = await import('node:sqlite'); } catch { sqlite = null; }

function breakdown(dimension, bucket, spendMicros, overrides = {}) {
  return { campaignId, date: '2026-10-08', dimension, bucket, spendMicros, impressions: 10, linkClicks: 1, websiteLeads: dimension === 'hour' ? 0 : 1, ...overrides };
}
function ad(adId, adName, spendMicros, overrides = {}) {
  return { adId, campaignId, date: '2026-10-08', adName, spendMicros, impressions: 100, linkClicks: 3, websiteLeads: 1, thruplays: 20, videoP25: 50, videoP50: 30, videoP75: 20, videoP100: 10, ...overrides };
}
function snapshot(collectedAt = '2026-10-08T01:00:00.000Z', { breakdowns = [breakdown('placement', 'instagram:instagram_reels', 500_000)], ads = [ad('120251206966710099', 'Reel A', 700_000)] } = {}) {
  return {
    account: { name: 'Choho', currency: 'USD', timezone: 'Asia/Seoul' },
    campaigns: [{ id: campaignId, name: 'Campaign', status: 'ACTIVE', effectiveStatus: 'ACTIVE', objective: 'OUTCOME_LEADS', spendCapCents: null, updatedAt: collectedAt }],
    rows: [{ campaignId, date: '2026-10-08', spendMicros: 1_000_001, impressions: 10, linkClicks: 2, landingPageViews: 1, websiteLeads: 1, dailyReach: 8, sourceJson: '{}', collectedAt }],
    breakdowns, ads,
    since: '2026-10-01', until: '2026-10-08', collectedAt,
  };
}
const breakdownPlan = { sql: 'SELECT bucket,SUM(spend_micros),SUM(impressions),SUM(website_leads) FROM meta_ads_breakdown_daily WHERE account_id=? AND dimension=? AND date>=? AND date<=? GROUP BY bucket LIMIT 100', params: [ACCOUNT_ID, 'placement', '2026-10-01', '2026-10-08'] };
const adPlan = { sql: 'SELECT ad_id,SUM(spend_micros),SUM(thruplays) FROM meta_ads_ad_daily WHERE account_id=? AND date>=? AND date<=? GROUP BY ad_id LIMIT 100', params: [ACCOUNT_ID, '2026-10-01', '2026-10-08'] };

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
      breakdownPlan,
      adPlan,
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
  for (const plan of report.plans.slice(0, 3)) {
    assert.match(plan, /idx_meta_ads_daily_account_date|sqlite_autoindex_meta_ads_daily_1/);
    assert.doesNotMatch(plan, /SCAN (?:d|meta_ads_daily)(?:\s|$)/);
  }
  assert.match(report.plans[3], /SEARCH meta_ads_breakdown_daily USING INDEX idx_meta_ads_breakdown_dim_date/);
  assert.match(report.plans[4], /SEARCH meta_ads_ad_daily USING INDEX idx_meta_ads_ad_daily_date/);
});

test('schema statements stay inside the migration scope guard', async () => {
  const statements = (await readFile(new URL('./schema.sql', import.meta.url), 'utf8')).split(';').map(sql => sql.trim()).filter(Boolean);
  assert.equal(statements.length, 8);
  for (const sql of statements) assert.match(sql, /^CREATE (?:TABLE|INDEX) IF NOT EXISTS (?:meta_ads_|idx_meta_ads_)/);
});

test('breakdown and ad tables replace only the scoped window and honor the lease guard', { skip: !sqlite && 'node:sqlite unavailable' }, async () => {
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  db.prepare("INSERT INTO meta_ads_sync(account_id,lease_owner,status) VALUES(?,?,'RUNNING')").run(ACCOUNT_ID, 'run-1');
  const run = statements => { db.exec('BEGIN'); try { const out = statements.map(s => db.prepare(s.sql).run(...s.params)); db.exec('COMMIT'); return out; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const lease = owner => db.prepare("UPDATE meta_ads_sync SET lease_owner=?,status='RUNNING' WHERE account_id=?").run(owner, ACCOUNT_ID);
  const all = sql => db.prepare(sql).all().map(row => ({ ...row }));
  const keep = "INSERT INTO meta_ads_breakdown_daily VALUES(?,?,?,'age','45-54',1,1,0,0,'old')";
  db.prepare(keep).run(ACCOUNT_ID, campaignId, '2026-09-30');
  db.prepare(keep).run(ACCOUNT_ID, otherCampaignId, '2026-10-08');
  db.prepare("INSERT INTO meta_ads_ad_daily(account_id,ad_id,campaign_id,date,ad_name,spend_micros,impressions,link_clicks,website_leads,collected_at) VALUES(?,?,?,?,?,1,1,0,0,'old')").run(ACCOUNT_ID, '120299999999999998', otherCampaignId, '2026-10-08', 'Other campaign ad');

  const first = run(commitStatements(snapshot('2026-10-08T01:00:00.000Z', {
    breakdowns: [breakdown('placement', 'instagram:instagram_reels', 500_000), breakdown('hour', '22', 200_000), breakdown('region', 'Seoul', 300_000)],
    ads: [ad('120251206966710099', 'Reel A', 700_000), ad('120251206966710100', 'Reel B', 100_000, { thruplays: 0, videoP25: 0, videoP50: 0, videoP75: 0, videoP100: 0 })],
  }), 'run-1'));
  assert.equal(first.at(-1).changes, 1);
  assert.deepEqual(all("SELECT dimension,bucket,spend_micros,website_leads FROM meta_ads_breakdown_daily WHERE campaign_id='" + campaignId + "' AND date='2026-10-08' ORDER BY dimension,bucket"), [
    { dimension: 'hour', bucket: '22', spend_micros: 200_000, website_leads: 0 },
    { dimension: 'placement', bucket: 'instagram:instagram_reels', spend_micros: 500_000, website_leads: 1 },
    { dimension: 'region', bucket: 'Seoul', spend_micros: 300_000, website_leads: 1 },
  ]);
  assert.deepEqual(all("SELECT ad_id,ad_name,thruplays,video_p100 FROM meta_ads_ad_daily WHERE campaign_id='" + campaignId + "' ORDER BY ad_id"), [
    { ad_id: '120251206966710099', ad_name: 'Reel A', thruplays: 20, video_p100: 10 },
    { ad_id: '120251206966710100', ad_name: 'Reel B', thruplays: 0, video_p100: 0 },
  ]);

  lease('run-2');
  const second = run(commitStatements(snapshot('2026-10-08T02:00:00.000Z', { breakdowns: [breakdown('placement', 'instagram:instagram_reels', 900_000)], ads: [ad('120251206966710099', 'Reel A v2', 800_000)] }), 'run-2'));
  assert.equal(second.at(-1).changes, 1);
  assert.deepEqual(all('SELECT campaign_id,date,dimension,bucket,spend_micros,collected_at FROM meta_ads_breakdown_daily ORDER BY campaign_id,date,dimension'), [
    { campaign_id: campaignId, date: '2026-09-30', dimension: 'age', bucket: '45-54', spend_micros: 1, collected_at: 'old' },
    { campaign_id: campaignId, date: '2026-10-08', dimension: 'placement', bucket: 'instagram:instagram_reels', spend_micros: 900_000, collected_at: '2026-10-08T02:00:00.000Z' },
    { campaign_id: otherCampaignId, date: '2026-10-08', dimension: 'age', bucket: '45-54', spend_micros: 1, collected_at: 'old' },
  ]);
  assert.deepEqual(all('SELECT ad_id,ad_name,spend_micros FROM meta_ads_ad_daily ORDER BY ad_id'), [
    { ad_id: '120251206966710099', ad_name: 'Reel A v2', spend_micros: 800_000 },
    { ad_id: '120299999999999998', ad_name: 'Other campaign ad', spend_micros: 1 },
  ]);

  lease('actual-owner');
  const before = db.prepare('SELECT total_changes() AS n').get().n;
  const lost = run(commitStatements(snapshot('2026-10-08T03:00:00.000Z', { breakdowns: [], ads: [] }), 'wrong-owner'));
  assert.equal(lost.at(-1).changes, 0);
  assert.equal(db.prepare('SELECT total_changes() AS n').get().n - before, 0);
  assert.equal(all('SELECT COUNT(*) AS n FROM meta_ads_breakdown_daily')[0].n, 3);

  assert.throws(() => db.prepare("INSERT INTO meta_ads_breakdown_daily VALUES(?,?,?,'country','KR',1,1,0,0,'x')").run(ACCOUNT_ID, campaignId, '2026-10-08'), /CHECK constraint failed/);
  const plans = [breakdownPlan, adPlan].map(q => db.prepare('EXPLAIN QUERY PLAN ' + q.sql).all(...q.params).map(row => row.detail).join(' | '));
  assert.match(plans[0], /USING INDEX idx_meta_ads_breakdown_dim_date/);
  assert.match(plans[1], /USING INDEX idx_meta_ads_ad_daily_date/);
  db.close();
});
