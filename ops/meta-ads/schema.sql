CREATE TABLE IF NOT EXISTS meta_ads_campaigns (
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_status TEXT NOT NULL,
  objective TEXT NOT NULL,
  spend_cap_cents INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS meta_ads_daily (
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  date TEXT NOT NULL,
  spend_micros INTEGER NOT NULL CHECK (spend_micros >= 0),
  impressions INTEGER NOT NULL CHECK (impressions >= 0),
  link_clicks INTEGER NOT NULL CHECK (link_clicks >= 0),
  landing_page_views INTEGER NOT NULL CHECK (landing_page_views >= 0),
  website_leads REAL NOT NULL CHECK (website_leads >= 0),
  daily_reach INTEGER NOT NULL CHECK (daily_reach >= 0),
  source_json TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  PRIMARY KEY (account_id, campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_daily_account_date
  ON meta_ads_daily (account_id, date DESC, campaign_id ASC);

CREATE TABLE IF NOT EXISTS meta_ads_sync (
  account_id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL DEFAULT 'chohopark',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  status TEXT NOT NULL DEFAULT 'NOT_COLLECTED',
  version INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  last_success_at TEXT,
  available_since TEXT,
  window_since TEXT,
  window_until TEXT,
  last_error_code TEXT,
  last_run_id TEXT,
  lease_owner TEXT,
  lease_expires_at TEXT,
  scope_json TEXT NOT NULL DEFAULT '[]'
);
