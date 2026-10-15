import { createContext, useContext, useRef, useState } from "react";
import type { Permission, StaffUser } from "./contract.gen";
import { t } from "./i18n";

/** Error from the Staff API: server code + Ukrainian message (never internal details). */
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
type StepUpHandler = () => Promise<boolean>;
let stepUp: StepUpHandler | null = null;
export const setStepUpHandler = (h: StepUpHandler | null) => {
  stepUp = h;
};

export const newKey = () => crypto.randomUUID().replaceAll("-", "");

type Options = {
  idem?: string;
  signal?: AbortSignal;
  method?: string;
  /** internal: the step-up re-entry already ran for this attempt */
  steppedUp?: boolean;
};

/**
 * One request to /api/staff. Mutations carry the CSRF token and the per-attempt Idempotency-Key.
 * STEP_UP_REQUIRED opens the re-entry dialog and repeats the same attempt (same key) once.
 */
export async function api<T>(
  path: string,
  body?: unknown,
  opts: Options = {},
): Promise<T> {
  const method = opts.method ?? (body === undefined ? "GET" : "POST");
  let response: Response;
  try {
    response = await fetch("/api/staff" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        method === "GET"
          ? undefined
          : {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
              ...(opts.idem ? { "Idempotency-Key": opts.idem } : {}),
            },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("OFFLINE", t.offline, {}, 0);
  }
  let result: {
    ok?: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    meta?: { csrf?: string };
  };
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      t.serviceUnavailable,
      {},
      response.status,
    );
  }
  if (result.meta?.csrf) csrf = result.meta.csrf;
  if (response.ok && result.ok) return result.data as T;
  const e = result.error ?? {
    code: "SERVICE_UNAVAILABLE",
    message: t.serviceUnavailable,
  };
  if (
    e.code === "STEP_UP_REQUIRED" &&
    !opts.steppedUp &&
    stepUp &&
    (await stepUp())
  )
    return api<T>(path, body, { ...opts, steppedUp: true });
  if (
    response.status === 401 &&
    e.code === "AUTH_REQUIRED" &&
    !path.startsWith("/auth/")
  )
    window.dispatchEvent(new Event("crm-auth-required"));
  throw new ApiError(
    e.code,
    e.message || t.serviceUnavailable,
    e.details ?? {},
    response.status,
  );
}

/** Download a CSV export (same session); returns false when the server refused. */
export async function download(
  path: string,
  body?: unknown,
  steppedUp = false,
): Promise<void> {
  const method = body === undefined ? "GET" : "POST";
  const r = await fetch("/api/staff" + path, {
    method,
    credentials: "same-origin",
    headers:
      method === "GET"
        ? undefined
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
            "Idempotency-Key": newKey(),
          },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    if (
      j?.error?.code === "STEP_UP_REQUIRED" &&
      !steppedUp &&
      stepUp &&
      (await stepUp())
    )
      return download(path, body, true);
    throw new ApiError(
      j?.error?.code ?? "SERVICE_UNAVAILABLE",
      j?.error?.message ?? t.serviceUnavailable,
      {},
      r.status,
    );
  }
  const blob = await r.blob();
  const name =
    /filename="([^"]+)"/.exec(
      r.headers.get("content-disposition") ?? "",
    )?.[1] ?? "export.csv";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  // Some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/**
 * Per-attempt idempotency key (M-11): stays the same for repeated submits of one attempt (double click = one
 * operation) and is replaced after success, a server error (5xx) or a lost connection, so the next deliberate
 * action never reuses an old key.
 */
export function useAttemptKey() {
  const [key, setKey] = useState(newKey);
  const ref = useRef(key);
  ref.current = key;
  return {
    key,
    renew: () => setKey(newKey()),
    afterError: (e: unknown) => {
      if (!(e instanceof ApiError) || e.status >= 500 || e.status === 0)
        setKey(newKey());
    },
  };
}

export const params = (
  values: Record<string, string | number | boolean | undefined | null>,
) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined && v !== null && v !== "" && v !== false)
      p.set(k, String(v));
  return p.size ? "?" + p.toString() : "";
};

// ---- workspace ----------------------------------------------------------------------------------------------------
export type Workspace = {
  user: StaffUser;
  notify: (message: string, tone?: "ok" | "error") => void;
};
export const WorkspaceContext = createContext<Workspace>({
  user: {} as StaffUser,
  notify: () => {},
});
export const useWorkspace = () => useContext(WorkspaceContext);
export const useCan = () => {
  const { user } = useWorkspace();
  // Contract permissions plus SITE domain permissions (e.g. order.price_override) that the server also returns.
  return (p: Permission | `order.${string}` | `payment.${string}`) =>
    (user.permissions ?? []).includes(p);
};

// ---- formatting (money in kopiyky, time stored UTC, shown Europe/Kyiv) --------------------------------------------
const uah = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 2,
});
export const money = (minor: number | null | undefined) =>
  minor === null || minor === undefined ? "—" : uah.format(minor / 100);
const asDate = (v: string) =>
  new Date(
    v.includes("T")
      ? v
      : v.replace(" ", "T") + (v.length > 10 ? "Z" : "T00:00:00Z"),
  );
const kyiv = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", ...o });
export const date = (v?: string | null, withTime = false) =>
  v
    ? kyiv({
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(asDate(v))
    : "—";
export const time = (v?: string | null) =>
  v ? kyiv({ hour: "2-digit", minute: "2-digit" }).format(asDate(v)) : "—";
export const shortDate = (v?: string | null) =>
  v ? kyiv({ day: "2-digit", month: "2-digit" }).format(asDate(v)) : "—";
export const pct = (now: number, prev: number) =>
  prev ? Math.round(((now - prev) / prev) * 1000) / 10 : null;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
export const telHref = (phone?: string | null) =>
  phone ? "tel:" + phone.replace(/[^+\d]/g, "") : undefined;
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Bank payment pages only (MonoPay); anything else is not rendered as a link. */
export const safeBankUrl = (u: string | null | undefined) =>
  typeof u === "string" && /^https:\/\/pay\.(mbnk\.biz|monobank\.ua)\//.test(u)
    ? u
    : null;
