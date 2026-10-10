export type Page = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};
export type Staff = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "LOGISTICS" | "READ_ONLY";
  permissions: string[];
  enabled?: number;
  session_version?: number;
};
export type Item = {
  name: string;
  product_id: string;
  sku: string;
  size?: string;
  color?: string;
  color_id?: string;
  qty: number;
  price: number;
  amount: number;
  image?: string;
  selection_type?: string;
  requires_order_confirmation?: boolean;
  availability_v3?: string;
  availability?: string;
  option_id?: string;
  price_pending?: boolean;
};
export type Shipment = {
  id: number;
  order_id: number;
  order_number?: string;
  tracking_number: string | null;
  status: string;
  supplier_code: string;
  created_at: string;
  updated_at: string;
  checked_at?: string;
  error?: string;
  lines_json: string;
  package_json: string;
  origin_label?: string;
};
export type Payment = {
  id: number;
  order_id: number;
  order_number?: string;
  invoice_id: string;
  reference: string;
  amount: number;
  status: string;
  refund_status: string;
  page_url: string;
  created_at: string;
  modified_at: string;
  payment_status?: string;
  pim_payment_state?: string;
};
export type Refund = {
  id: number;
  amount: number;
  status: string;
  reason: string;
  ext_ref: string;
  updated_at: string;
};
export type Return = {
  id: number;
  order_id: number;
  order_number?: string;
  state: string;
  version: number;
  refund_expected_minor: number;
  refund_allocations_json: string | null;
  lines_json: string;
  reason: string;
  inventory_decision: string;
  inventory_evidence: string;
  tracking_number: string;
  created_at: string;
};
export type Note = {
  id: number;
  body: string;
  author: string;
  created_at: string;
};
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phone_raw?: string;
  phone_verified?: boolean;
  identity_evidence?: string;
  source?: string;
  orders?: number;
  paid_total?: number;
  active_orders?: number;
  last_order?: string;
};
export type Order = {
  id: number;
  number: string;
  created_at: string;
  updated_at: string;
  version: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  order_status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  review_required: boolean;
  review_flags: string[];
  customer: Customer;
  items: Item[];
  contact: Record<string, unknown>;
  fulfillment_lines: {
    line_no: number;
    sku: string;
    supplier_code: string;
    qty: string;
    line_amount: string;
    sale_unit: string;
  }[];
  remaining: Record<string, { qty: number; amount: number }>;
  shipments: Shipment[];
  payments: Payment[];
  refunds: Refund[];
  returns: Return[];
  assigned_manager: { id: string; name: string } | null;
  latest_note: Note | null;
  blockers: string[];
  notes: Note[];
  timeline: { event: string; occurred_at: string; detail_json: string }[];
  sku_candidates: {
    line_no: number;
    label: string;
    skus: { sku: string; label: string }[];
  }[];
  invoice?: { url: string; invoice_id: string } | null;
};
export type List<T> = { rows: T[]; pagination: Page };
export type Sender = {
  code: string;
  name: string;
  city: string;
  region: string;
  branch: string;
  cargo_branch: string;
  city_ref: string;
  warehouse_ref: string;
  cargo_warehouse_ref: string;
  sender_ref: string;
  contact_ref: string;
  phone: string;
  confirmed: number;
  version: number;
};
export type Settings = {
  staff: Staff[];
  sender_profiles: Sender[];
  permissions: string[];
};
export type Financial = {
  paid_orders: number;
  paid_revenue: number;
  refunds: number;
  net_revenue: number;
  average_paid_order: number;
  daily: { date: string; amount: number }[];
};
export type Report = {
  period: { from: string; to: string; timezone: string };
  metrics: {
    orders_created: number;
    confirmation_queue: number;
    delivered: number;
    returns: number;
  };
  financial: Financial | null;
};
export type Dashboard = {
  today: Report;
  counts: {
    total: number;
    confirmation: number;
    waiting_payment: number;
    paid_to_ship: number;
    transit: number;
    problems: number;
  };
  requires_action: Order[];
  problems: Order[];
};
export type Audit = {
  id: number;
  actor: string;
  actor_role: string;
  source: string;
  entity: string;
  entity_id: string;
  action: string;
  old: unknown;
  new: unknown;
  reason: string;
  request_id: string;
  created_at: string;
};
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown>,
    public status: number,
  ) {
    super(message);
  }
}
let csrf = "";
export async function api<T>(
  path: string,
  body?: Record<string, unknown>,
  method = body ? "POST" : "GET",
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/staff" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ ...body, csrf }) : undefined,
    signal,
  });
  const result = await response.json();
  if (result.meta?.csrf) csrf = result.meta.csrf;
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event("crm-auth-required"));
  if (!response.ok || !result.ok) {
    const e = result.error ?? {};
    throw new ApiError(
      e.code ?? "SERVICE_UNAVAILABLE",
      e.message ?? "Сервіс тимчасово недоступний.",
      e.details ?? {},
      response.status,
    );
  }
  return result.data as T;
}
export const requestId = () => crypto.randomUUID().replaceAll("-", "");
export function params(
  values: Record<string, string | number | boolean | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  return p.size ? "?" + p.toString() : "";
}
