export type ContractStatus =
  | "draft"
  | "issued"
  | "sent"
  | "viewed"
  | "signed"
  | "deposit_received"
  | "confirmed"
  | "cancelled"
  | "superseded";

export interface ContractSummary {
  id: string;
  contractNumber: string;
  productName: string;
  company: string;
  customerName: string;
  phone: string;
  useDate: string;
  people: number;
  totalAmount: number;
  status: ContractStatus;
  createdAt: string;
}

export interface ContractEvent {
  id: string;
  type: string;
  label: string;
  occurredAt: string;
  actor: string;
  detail: string;
}

export interface ContractDetail extends ContractSummary {
  email: string;
  representative: string;
  businessRegistrationNumber: string;
  address: string;
  seminarTime: string;
  extraRooms: string;
  discountAmount: number;
  depositAmount: number;
  depositReceivedAt: string;
  signedAt: string;
  signerName: string;
  confirmedAt: string;
  originalUrl: string;
  originalHtml: string;
  notes: string;
  events: ContractEvent[];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function first(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function text(
  record: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  const value = first(record, keys);
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function amount(record: Record<string, unknown>, keys: string[]): number {
  const value = first(record, keys);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: string): ContractStatus {
  const known: ContractStatus[] = [
    "draft",
    "issued",
    "sent",
    "viewed",
    "signed",
    "deposit_received",
    "confirmed",
    "cancelled",
    "superseded",
  ];
  return known.includes(value as ContractStatus)
    ? (value as ContractStatus)
    : "draft";
}

function normalizeSummary(value: unknown): ContractSummary {
  const row = object(value);
  const customer = object(first(row, ["customer", "party", "client"]));
  return {
    id: text(row, ["id", "contractId", "contract_id"]),
    contractNumber: text(
      row,
      ["contractNumber", "contract_number"],
      "번호 미지정",
    ),
    productName: text(
      row,
      ["productName", "product_name", "packageName", "package_name"],
      "이용상품 미지정",
    ),
    company: text(
      row,
      ["company", "companyName", "company_name"],
      text(customer, ["company", "companyName"]),
    ),
    customerName: text(
      row,
      ["customerName", "customer_name", "contactName", "contact_name"],
      text(customer, ["name", "customerName"]),
    ),
    phone: text(
      row,
      ["phone", "customerPhone", "customer_phone"],
      text(customer, ["phone"]),
    ),
    useDate: text(row, ["useDate", "use_date", "eventDate", "event_date"]),
    people: amount(row, [
      "people",
      "guestCount",
      "guest_count",
      "totalPeople",
      "total_people",
    ]),
    totalAmount: amount(row, [
      "totalAmount",
      "total_amount",
      "quotedTotal",
      "quoted_total",
    ]),
    status: normalizeStatus(text(row, ["status"])),
    createdAt: text(row, ["createdAt", "created_at"]),
  };
}

function normalizeEvent(value: unknown, index: number): ContractEvent {
  const event = object(value);
  return {
    id: text(event, ["id"], String(index)),
    type: text(event, ["type", "eventType", "event_type"]),
    label: text(
      event,
      ["label", "title", "type", "eventType", "event_type"],
      "상태 변경",
    ),
    occurredAt: text(event, [
      "occurredAt",
      "occurred_at",
      "createdAt",
      "created_at",
    ]),
    actor: text(event, ["actor", "actorName", "actor_name"]),
    detail: text(event, ["detail", "description", "message"]),
  };
}

function normalizeDetail(value: unknown): ContractDetail {
  const row = object(value);
  const summary = normalizeSummary(row);
  const customer = object(first(row, ["customer", "party", "client"]));
  const artifacts = object(first(row, ["artifacts", "document", "original"]));
  const rawEvents = first(row, ["events", "history"]);
  return {
    ...summary,
    email: text(
      row,
      ["email", "customerEmail", "customer_email"],
      text(customer, ["email"]),
    ),
    representative: text(
      row,
      ["representative", "companyRepresentative", "company_representative"],
      text(customer, ["representative"]),
    ),
    businessRegistrationNumber: text(
      row,
      ["businessRegistrationNumber", "business_registration_number"],
      text(customer, ["businessRegistrationNumber"]),
    ),
    address: text(
      row,
      ["address", "companyAddress", "company_address"],
      text(customer, ["address"]),
    ),
    seminarTime: text(row, [
      "seminarTime",
      "seminar_time",
      "seminarHours",
      "seminar_hours",
    ]),
    extraRooms: text(row, [
      "extraRooms",
      "extra_rooms",
      "roomNotes",
      "room_notes",
    ]),
    discountAmount: amount(row, ["discountAmount", "discount_amount"]),
    depositAmount: amount(row, ["depositAmount", "deposit_amount"]),
    depositReceivedAt: text(row, ["depositReceivedAt", "deposit_received_at"]),
    signedAt: text(row, ["signedAt", "signed_at"]),
    signerName: text(row, ["signerName", "signer_name"]),
    confirmedAt: text(row, ["confirmedAt", "confirmed_at"]),
    originalUrl: text(
      row,
      ["originalUrl", "original_url", "documentUrl", "document_url"],
      text(artifacts, ["originalUrl", "issuedHtmlUrl", "url"]),
    ),
    originalHtml: text(
      row,
      ["originalHtml", "original_html", "issuedHtml"],
      text(artifacts, ["html", "issuedHtml"]),
    ),
    notes: text(row, ["notes", "memo"]),
    events: Array.isArray(rawEvents) ? rawEvents.map(normalizeEvent) : [],
  };
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function errorMessage(value: unknown, fallback: string): string {
  const row = object(value);
  return text(row, ["message", "error"], fallback);
}

export async function getContracts(
  params: { query?: string; status?: string } = {},
): Promise<ContractSummary[]> {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.status) search.set("status", params.status);
  search.set("page", "1");
  const response = await fetch(`/api/contract-proxy?${search.toString()}`, {
    cache: "no-store",
  });
  const body = await responseJson(response);
  if (!response.ok)
    throw new Error(errorMessage(body, "약정서 목록을 불러오지 못했습니다."));
  const root = object(body);
  const rows = first(root, ["contracts", "items", "data"]);
  return Array.isArray(rows) ? rows.map(normalizeSummary) : [];
}

export async function getContract(id: string): Promise<ContractDetail> {
  const response = await fetch(
    `/api/contract-proxy/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  const body = await responseJson(response);
  if (!response.ok)
    throw new Error(errorMessage(body, "약정서를 불러오지 못했습니다."));
  const root = object(body);
  return normalizeDetail(first(root, ["contract", "data"]) ?? root);
}

export async function confirmDeposit(id: string): Promise<void> {
  const response = await fetch(
    `/api/contract-proxy/${encodeURIComponent(id)}/deposit`,
    { method: "POST" },
  );
  const body = await responseJson(response);
  if (!response.ok)
    throw new Error(errorMessage(body, "계약금 확인을 처리하지 못했습니다."));
}

export async function updateContractStatus(
  id: string,
  status: ContractStatus,
): Promise<void> {
  const response = await fetch(
    `/api/contract-proxy/${encodeURIComponent(id)}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  const body = await responseJson(response);
  if (!response.ok)
    throw new Error(errorMessage(body, "상태를 변경하지 못했습니다."));
}

export const statusLabel: Record<ContractStatus, string> = {
  draft: "작성 중",
  issued: "서명 대기",
  sent: "링크 전달",
  viewed: "고객 열람",
  signed: "서명 완료",
  deposit_received: "입금 확인",
  confirmed: "예약 확정",
  cancelled: "취소",
  superseded: "대체됨",
};

export const statusClass: Record<ContractStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  signed: "bg-teal-100 text-teal-800",
  deposit_received: "bg-cyan-100 text-cyan-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  superseded: "bg-gray-200 text-gray-500",
};
