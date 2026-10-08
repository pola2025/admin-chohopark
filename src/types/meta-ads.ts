export interface MetaAdsMetrics {
  spendUsd: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  websiteLeads: number;
  linkCtr: number | null;
  costPerLinkClickUsd: number | null;
  costPerLeadUsd: number | null;
}

export interface MetaAdsCampaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  spendCapUsd: number | null;
  updatedAt: string;
  metrics: MetaAdsMetrics;
}

export interface MetaAdsDashboard {
  account: { id: string; name: string; currency: "USD"; timezone: "Asia/Seoul" };
  range: { start: string; end: string; days: number; campaignId: string | null };
  summary: MetaAdsMetrics;
  campaigns: MetaAdsCampaign[];
  daily: Array<MetaAdsMetrics & { date: string; campaigns: number }>;
  rows: Array<MetaAdsMetrics & { date: string; campaignId: string; campaignName: string; dailyReach: number; collectedAt: string }>;
  nextCursor: string | null;
  sync: { lastSuccessAt: string | null; lastAttemptAt: string | null; status: string; version: number; stale: boolean; intervalMinutes: number; availableSince: string | null; attribution: string; hasData: boolean };
}
