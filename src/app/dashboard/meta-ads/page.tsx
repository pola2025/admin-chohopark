import { MetaAdsDashboardView } from "@/components/dashboard/meta-ads-dashboard";
import { getMetaAdsDashboard } from "@/lib/meta-ads";
import { redirect } from "next/navigation";

const DEFAULT_CAMPAIGN_ID = "120250878150770043";
const ALLOWED_DAYS = new Set([7, 30, 90]);

type MetaAdsPageProps = {
  searchParams: Promise<{
    days?: string | string[];
    campaign?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MetaAdsPage({ searchParams }: MetaAdsPageProps) {
  const params = await searchParams;
  const requestedDays = Number(first(params.days));
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 30;
  const campaignParam = first(params.campaign);
  const campaign = campaignParam === "all" ? "all" : campaignParam || DEFAULT_CAMPAIGN_ID;
  let initialData;
  try {
    initialData = await getMetaAdsDashboard({ days, campaign });
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : null;
    if (status === 401) redirect("/login");

    return (
      <section className="border border-[var(--gov-danger)] bg-[var(--gov-danger-weak)] p-5">
        <h2 className="text-[16px] font-bold text-[var(--gov-danger)]">
          Meta 광고 데이터를 불러오지 못했습니다
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--gov-ink-sub)]">
          잠시 후 새로고침해 주세요. 문제가 계속되면 마지막 수집 상태를 확인해 주세요.
        </p>
      </section>
    );
  }

  return (
    <MetaAdsDashboardView
      key={`${days}:${campaign}`}
      initialData={initialData}
      days={days}
      campaign={campaign}
    />
  );
}
