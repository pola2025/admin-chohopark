import type { ReactNode } from "react";

export type CreationOrigin = "APP" | "WEB";

export function normalizeCreationOrigin(value: unknown): CreationOrigin | null {
  return value === "APP" || value === "WEB" ? value : null;
}

export function OriginBadge({ origin }: { origin: CreationOrigin | null }): ReactNode {
  if (!origin) return null;
  return (
    <span className={origin === "APP"
      ? "inline-flex rounded-full bg-[#e7f0ff] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#214f99]"
      : "inline-flex rounded-full bg-[#f1eafd] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#64428a]"}>
      {origin}
    </span>
  );
}
