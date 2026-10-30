import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_ID,
  BREAKDOWN_DIMENSIONS,
  actionValue,
  breakdownBucket,
  normalizeAdInsight,
  normalizeBreakdown,
  normalizeInsight,
  rangeInput,
  usdMicros,
  videoMetric,
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

test('breakdown buckets normalize each known dimension and reject unknown or malformed values', () => {
  assert.deepEqual(BREAKDOWN_DIMENSIONS, ['placement', 'age', 'gender', 'region', 'device', 'hour']);
  assert.equal(breakdownBucket('placement', { publisher_platform: 'instagram', platform_position: 'instagram_reels' }), 'instagram:instagram_reels');
  assert.equal(breakdownBucket('age', { age: '45-54' }), '45-54');
  assert.equal(breakdownBucket('age', { age: '65+' }), '65+');
  for (const gender of ['male', 'female', 'unknown']) assert.equal(breakdownBucket('gender', { gender }), gender);
  assert.equal(breakdownBucket('region', { region: 'Gyeonggi-do' }), 'Gyeonggi-do');
  assert.equal(breakdownBucket('device', { device_platform: 'mobile_app' }), 'mobile_app');
  assert.throws(() => breakdownBucket('platform', { publisher_platform: 'instagram' }), /BREAKDOWN_DIMENSION_INVALID/);
  assert.throws(() => breakdownBucket('placement', { publisher_platform: 'instagram' }), /BREAKDOWN_BUCKET_INVALID/);
  assert.throws(() => breakdownBucket('placement', { publisher_platform: 'instagram', platform_position: 'x'.repeat(80) }), /BREAKDOWN_BUCKET_INVALID/);
  assert.throws(() => breakdownBucket('gender', { gender: 'Female' }), /BREAKDOWN_BUCKET_INVALID/);
  assert.throws(() => breakdownBucket('region', { region: '  ' }), /BREAKDOWN_BUCKET_INVALID/);
  assert.throws(() => breakdownBucket('region', { region: 'Seoul\n' }), /BREAKDOWN_BUCKET_INVALID/);
  assert.throws(() => breakdownBucket('device', {}), /BREAKDOWN_BUCKET_INVALID/);
  assert.throws(() => breakdownBucket('age', { age: 45 }), /BREAKDOWN_BUCKET_INVALID/);
});

test('hour buckets come from the advertiser-time-zone hourly range as two-digit hours', () => {
  const hour = value => breakdownBucket('hour', { hourly_stats_aggregated_by_advertiser_time_zone: value });
  assert.equal(hour('22:00:00 - 22:59:59'), '22');
  assert.equal(hour('00:00:00 - 00:59:59'), '00');
  assert.equal(hour('09:00:00 - 09:59:59'), '09');
  for (const bad of ['24:00:00 - 24:59:59', '22:00:00 - 23:59:59', '9:00:00 - 9:59:59', '22:00:00-22:59:59', '22', '', undefined, 22]) assert.throws(() => hour(bad), /BREAKDOWN_BUCKET_INVALID/);
});

test('breakdown rows validate ownership and window, and hour rows never carry leads', () => {
  const input = { accountId: ACCOUNT_ID, campaignIds: [campaignId], since: '2026-10-01', until: '2026-10-08', collectedAt: '2026-10-08T01:00:00.000Z' };
  const base = { account_id: ACCOUNT_ID, campaign_id: campaignId, date_start: '2026-10-08', date_stop: '2026-10-08', spend: '1.25', impressions: '10', inline_link_clicks: '2', actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', value: '4', '7d_click': '1' }] };
  assert.deepEqual(normalizeBreakdown({ ...base, age: '45-54' }, 'age', input), { campaignId, date: '2026-10-08', spendMicros: 1_250_000, impressions: 10, linkClicks: 2, dimension: 'age', bucket: '45-54', websiteLeads: 1, collectedAt: input.collectedAt });
  assert.equal(normalizeBreakdown({ ...base, hourly_stats_aggregated_by_advertiser_time_zone: '13:00:00 - 13:59:59' }, 'hour', input).websiteLeads, 0);
  assert.throws(() => normalizeBreakdown({ ...base, age: '45-54' }, 'country', input), /BREAKDOWN_DIMENSION_INVALID/);
  assert.throws(() => normalizeBreakdown({ ...base, account_id: '999999999999999', age: '45-54' }, 'age', input), /SOURCE_ACCOUNT_MISMATCH/);
  assert.throws(() => normalizeBreakdown({ ...base, date_stop: '2026-10-07', age: '45-54' }, 'age', input), /SOURCE_DATE_MISMATCH/);
  assert.throws(() => normalizeBreakdown({ ...base, impressions: '-1', age: '45-54' }, 'age', input), /INVALID_METRIC/);
  assert.throws(() => normalizeBreakdown(null, 'age', input), /SOURCE_ROW_INVALID/);
});

test('ad rows read video metrics from value, fall back to 7d_click, and default to zero', () => {
  assert.equal(videoMetric([{ action_type: 'video_view', value: '705' }]), 705);
  assert.equal(videoMetric([{ action_type: 'video_view', '7d_click': '12' }]), 12);
  assert.equal(videoMetric(undefined), 0);
  assert.equal(videoMetric([]), 0);
  assert.throws(() => videoMetric([{ action_type: 'video_view', value: '1' }, { action_type: 'video_view', value: '2' }]), /DUPLICATE_ACTION_TYPE/);
  assert.throws(() => videoMetric([{ action_type: 'video_view', value: '1.5' }]), /INVALID_METRIC/);
  assert.throws(() => videoMetric({ value: '1' }), /INVALID_VIDEO_ACTIONS/);
  const input = { accountId: ACCOUNT_ID, campaignIds: [campaignId], since: '2026-10-01', until: '2026-10-08', collectedAt: '2026-10-08T01:00:00.000Z' };
  const row = { account_id: ACCOUNT_ID, campaign_id: campaignId, ad_id: '120251206966710099', ad_name: 'Reel A', date_start: '2026-10-08', date_stop: '2026-10-08', spend: '3', impressions: '100', inline_link_clicks: '4', video_p100_watched_actions: [{ action_type: 'video_view', value: '33' }] };
  const ad = normalizeAdInsight(row, input);
  assert.deepEqual([ad.adId, ad.adName, ad.spendMicros, ad.websiteLeads, ad.thruplays, ad.videoP100], ['120251206966710099', 'Reel A', 3_000_000, 0, 0, 33]);
  assert.throws(() => normalizeAdInsight({ ...row, ad_id: 'abc' }, input), /AD_IDENTITY_INVALID/);
  assert.throws(() => normalizeAdInsight({ ...row, ad_id: 120251206966710099 }, input), /AD_IDENTITY_INVALID/);
  assert.throws(() => normalizeAdInsight({ ...row, ad_name: 'x'.repeat(501) }, input), /AD_IDENTITY_INVALID/);
  assert.throws(() => normalizeAdInsight({ ...row, ad_name: undefined }, input), /AD_IDENTITY_INVALID/);
});
