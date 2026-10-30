import { MetaInflowDashboard } from "@/components/dashboard/meta-inflow-dashboard";

type MetaAdsPageProps = {
  searchParams: Promise<{ campaign?: string | string[] }>;
};

export default async function MetaAdsPage({ searchParams }: MetaAdsPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.campaign)
    ? params.campaign[0]
    : params.campaign;
  // 기본은 계정 전체 캠페인. 특정 캠페인은 방문자 통계 유입 표에서 링크로 넘어온다.
  const campaign = raw && /^\d{5,32}$/.test(raw) ? raw : "all";
  return <MetaInflowDashboard key={campaign} initialCampaign={campaign} />;
}
