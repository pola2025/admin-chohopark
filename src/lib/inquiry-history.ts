/**
 * 접수 이력 회차 계산.
 *
 * 빠른문의를 낸 뒤 곧바로 계산기로 견적까지 받는 흐름이 흔해서, 24시간 이내
 * 연속 접수는 한 번의 문의로 묶는다. 그렇게 묶은 단위를 회차로 센다.
 */
const SESSION_GAP_MS = 24 * 60 * 60 * 1000;

export interface HistoryRow {
  id: number;
  kind: string;
  kind_label: string;
  product_name: string | null;
  people_count: number | null;
  use_date: string | null;
  created_at: string;
}

export interface HistoryEntry extends HistoryRow {
  visitNo: number;
}

/** "2026-08-23 07:04:58"(UTC)을 Date로. 형식이 다르면 그대로 파싱한다. */
export function parseCreatedAt(value: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return new Date(iso);
}

/** 한 사람의 접수 이력에 회차를 매긴다(오래된 순으로 반환). */
export function assignVisitNumbers(rows: HistoryRow[]): HistoryEntry[] {
  const ordered = [...rows].sort(
    (a, b) =>
      parseCreatedAt(a.created_at).getTime() -
      parseCreatedAt(b.created_at).getTime(),
  );
  let visitNo = 0;
  let previous = 0;
  return ordered.map((row) => {
    const at = parseCreatedAt(row.created_at).getTime();
    if (visitNo === 0 || at - previous > SESSION_GAP_MS) visitNo += 1;
    previous = at;
    return { ...row, visitNo };
  });
}
