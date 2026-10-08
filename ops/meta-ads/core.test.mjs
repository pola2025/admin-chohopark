import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_ID,
  actionValue,
  normalizeInsight,
  rangeInput,
  usdMicros,
} from '../../src/lib/meta-ads-core.mjs';

const campaignId = '120250878150770043';

test('USD amounts are stored exactly as integer micros', () => {
  assert.equal(usdMicros('0.000001'), 1);
  assert.equal(usdMicros('12.345678'), 12_345_678);
  assert.equal(usdMicros('999999999.999999'), 999_999_999_999_999);
  assert.throws(() => usdMicros('0.0000001'), /INVALID_SPEND/);
});

test('website lead attribution uses only the 7d_click field', () => {
  assert.equal(actionValue([
    { action_type: 'offsite_conversion.fb_pixel_lead', value: '9', '1d_view': '9' },
  ], 'offsite_conversion.fb_pixel_lead'), 0);
  assert.equal(actionValue([
    { action_type: 'offsite_conversion.fb_pixel_lead', value: '9', '1d_view': '7', '7d_click': '2' },
  ], 'offsite_conversion.fb_pixel_lead'), 2);
});

test('normalization rejects foreign accounts, dates, and duplicate lead actions', () => {
  const base = {
    account_id: ACCOUNT_ID,
    campaign_id: campaignId,
    date_start: '2026-10-08',
    date_stop: '2026-10-08',
    spend: '1.25',
    impressions: '10',
    inline_link_clicks: '2',
    reach: '8',
    actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', '7d_click': '1' }],
  };
  const input = { accountId: ACCOUNT_ID, campaignIds: [campaignId], since: '2026-10-01', until: '2026-10-08', collectedAt: '2026-10-08T01:00:00.000Z' };
  assert.equal(normalizeInsight(base, input).websiteLeads, 1);
  assert.throws(() => normalizeInsight({ ...base, account_id: '999999999999999' }, input), /SOURCE_ACCOUNT_MISMATCH/);
  assert.throws(() => normalizeInsight({ ...base, date_start: '2026-09-30', date_stop: '2026-09-30' }, input), /SOURCE_DATE_MISMATCH/);
  assert.throws(() => normalizeInsight({ ...base, actions: [...base.actions, ...base.actions] }, input), /DUPLICATE_ACTION_TYPE/);
});

test('dashboard ranges are bounded to 7, 30, or 90 KST days', () => {
  assert.deepEqual(rangeInput({ days: '90', campaign: campaignId }, new Date('2026-10-08T12:00:00Z')), {
    start: '2026-07-11', end: '2026-10-08', days: 90, campaignId,
  });
  assert.throws(() => rangeInput({ days: '91' }, new Date('2026-10-08T12:00:00Z')), /INVALID_RANGE/);
  assert.throws(() => rangeInput({ days: '30', campaign: 'other-account' }, new Date('2026-10-08T12:00:00Z')), /INVALID_CAMPAIGN/);
});
