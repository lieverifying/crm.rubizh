import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Minus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { Page, StatusPart, Status3 as Status3T } from "./contract.gen";
import { ApiError, pct, useAttemptKey } from "./lib";
import { t } from "./i18n";

export function PageHead({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      {(title || meta) && (
        <div className="panel-head">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {meta}
        </div>
      )}
      {children}
    </section>
  );
}

const tones: Record<string, string> = {
  PAID: "ok",
  DELIVERED: "ok",
  COMPLETED: "ok",
  CONFIRMED: "ok",
  CLOSED: "ok",
  success: "ok",
  delivered: "ok",
  DONE: "ok",
  APPROVED: "ok",
  WAITING_CONFIRMATION: "warn",
  AWAITING: "warn",
  PREPARING: "warn",
  PACKING: "warn",
  EXPIRED_RETRY: "warn",
  REQUESTED: "warn",
  OPEN: "warn",
  created: "warn",
  draft: "warn",
  processing: "warn",
  REFUND_PENDING: "warn",
  FAILED: "bad",
  NEEDS_REVIEW: "bad",
  CANCELLED: "bad",
  RETURNING: "bad",
  REVIEW: "bad",
  unknown: "bad",
  error: "bad",
  manual: "bad",
  failure: "bad",
  REJECTED: "bad",
  SENT: "info",
  HANDED_TO_DELIVERY: "info",
  PARTIALLY_REFUNDED: "info",
  REFUNDED: "info",
  NEW: "info",
  sent: "info",
  IN_TRANSIT: "info",
  IN_PROGRESS: "info",
  RECEIVED: "info",
};
export function Pill({
  code,
  children,
}: {
  code?: string | null;
  children: ReactNode;
}) {
  return (
    <span className={"pill " + (tones[code ?? ""] ?? "")}>{children}</span>
  );
}
export function StatusPill({ part }: { part: StatusPart }) {
  return <Pill code={part.code}>{part.label}</Pill>;
}
/** Order, payment and delivery shown separately, as in the customer cabinet (ТЗ §6). */
export function Status3({
  display,
  captions = false,
}: {
  display: Status3T;
  captions?: boolean;
}) {
  const parts: [string, StatusPart][] = [
    ["Замовлення", display.order],
    ["Оплата", display.payment],
    ["Доставка", display.delivery],
  ];
  return (
    <div className="status3">
      {parts.map(([name, p]) => (
        <span key={name}>
          {captions && <span className="caption">{name}</span>}
          <span className="sr-only">{name}: </span>
          <StatusPill part={p} />
        </span>
      ))}
    </div>
  );
}

export function Delta({
  now,
  prev,
}: {
  now: number | null | undefined;
  prev: number | null | undefined;
}) {
  if (now === null || now === undefined || prev === null || prev === undefined)
    return null;
  const d = pct(now, prev);
  if (d === null)
    return <span className="delta flat">без бази порівняння</span>;
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className={"delta " + (d > 0 ? "up" : d < 0 ? "down" : "flat")}>
      <Icon size={12} aria-hidden="true" />
      {Math.abs(d)}%
      <span className="sr-only">
        {d > 0 ? " більше" : d < 0 ? " менше" : ""} ніж у попередньому періоді
      </span>
    </span>
  );
}
export function Kpi({
  title,
  value,
  hint,
  now,
  prev,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  now?: number | null;
  prev?: number | null;
}) {
  return (
    <div className="panel kpi">
      <div className="sub">{title}</div>
      <div className="value">{value}</div>
      <div className="row">
        <Delta now={now} prev={prev} />
        {hint && <small className="muted">{hint}</small>}
      </div>
    </div>
  );
}

export function Loading({ rows = 0 }: { rows?: number }) {
  if (rows)
    return (
      <div className="panel-body stack" role="status" aria-label={t.loading}>
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    );
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} aria-hidden="true" /> {t.loading}
    </div>
  );
}
export function Empty({
  title = t.empty,
  text = t.emptyHint,
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorBox({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError ? error.message : t.serviceUnavailable;
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <p>{message}</p>
      {onRetry && (
        <button className="btn small" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" /> {t.retry}
        </button>
      )}
    </div>
  );
}
export function Note({
  tone = "",
  children,
}: {
  tone?: "" | "bad" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={"note-box " + tone}
      role={tone === "bad" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  counts,
}: {
  items: [string, string][];
  value: string;
  onChange: (v: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, name]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          className={"tab " + (value === k ? "active" : "")}
          onClick={() => onChange(k)}
        >
          {name}
          {counts && counts[k] !== undefined && (
            <span className="count">{counts[k]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
export function PeriodSelect({
  value,
  onChange,
  from,
  to,
  onRange,
}: {
  value: string;
  onChange: (v: string) => void;
  from?: string;
  to?: string;
  onRange?: (f: string, to: string) => void;
}) {
  const id = useId();
  return (
    <span className="row">
      <label htmlFor={id} className="sr-only">
        Період
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(t.period).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {value === "custom" && onRange && (
        <>
          <input
            aria-label="З дати"
            type="date"
            value={from ?? ""}
            onChange={(e) => onRange(e.target.value, to ?? "")}
          />
          <input
            aria-label="До дати"
            type="date"
            value={to ?? ""}
            onChange={(e) => onRange(from ?? "", e.target.value)}
          />
        </>
      )}
    </span>
  );
}
export function Pager({
  page,
  onChange,
}: {
  page: Page;
  onChange: (p: number) => void;
}) {
  const first = page.total ? (page.page - 1) * page.limit + 1 : 0;
  return (
    <div className="pager">
      <span>
        {first}–{Math.min(page.page * page.limit, page.total)} з {page.total}
      </span>
      <span className="row">
        <button
          className="icon-btn"
          aria-label="Попередня сторінка"
          disabled={page.page <= 1}
          onClick={() => onChange(page.page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {page.page} / {Math.max(1, page.pages)}
        </span>
        <button
          className="icon-btn"
          aria-label="Наступна сторінка"
          disabled={page.page >= page.pages}
          onClick={() => onChange(page.page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </span>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function useDebounce<T>(value: T, delay = 300) {
  const [v, set] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => set(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return v;
}

/** Accessible modal: focus trap, Esc closes, focus returns to the trigger, background scroll locked. */
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
        ) ?? [],
      );
    (
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      items()[1] ??
      items()[0]
    )?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab") return;
      const list = items(),
        first = list[0],
        last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className={"dialog " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label={t.close} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
export function Toast({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: "ok" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const h = setTimeout(onClose, 5000);
    return () => clearTimeout(h);
  }, [message, onClose]);
  return (
    <div
      className={"toast " + (tone === "error" ? "error" : "")}
      role="status"
      aria-live="polite"
    >
      {tone === "ok" ? (
        <Check size={16} aria-hidden="true" />
      ) : (
        <AlertCircle size={16} aria-hidden="true" />
      )}
      <span>{message}</span>
      <button className="icon-btn" aria-label={t.close} onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}

export type Column<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  sort?: string;
  className?: string;
};
/** Table from 1024 px; cards below (M-10): number, client, amount, three statuses, primary action. */
export function DataView<T>({
  rows,
  columns,
  card,
  rowKey,
  sort,
  onSort,
  selectable,
  selected,
  onSelect,
}: {
  rows: T[];
  columns: Column<T>[];
  card: (row: T) => ReactNode;
  rowKey: (row: T) => string | number;
  sort?: string;
  onSort?: (key: string) => void;
  selectable?: boolean;
  selected?: Set<string | number>;
  onSelect?: (keys: Set<string | number>) => void;
}) {
  const all =
    selectable &&
    rows.length > 0 &&
    rows.every((r) => selected?.has(rowKey(r)));
  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {selectable && (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Обрати всі на сторінці"
                    checked={!!all}
                    onChange={() =>
                      onSelect?.(all ? new Set() : new Set(rows.map(rowKey)))
                    }
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.className}
                  aria-sort={
                    sort && c.sort && sort.replace("-", "") === c.sort
                      ? sort.startsWith("-")
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  {c.sort && onSort ? (
                    <button onClick={() => onSort(c.sort!)}>{c.title}</button>
                  ) : (
                    c.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {selectable && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Обрати рядок"
                      checked={!!selected?.has(rowKey(r))}
                      onChange={() => {
                        const n = new Set(selected);
                        n.has(rowKey(r))
                          ? n.delete(rowKey(r))
                          : n.add(rowKey(r));
                        onSelect?.(n);
                      }}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cards">
        {rows.map((r) => (
          <div key={rowKey(r)}>{card(r)}</div>
        ))}
      </div>
    </>
  );
}

/**
 * Dialog for one server action: reason (when needed), one attempt key, submit disabled while running.
 * STALE_ORDER → the order is refreshed and the button offers a retry on the new version (M-16).
 */
export function ActionDialog({
  title,
  children,
  onSubmit,
  onClose,
  onStale,
  needReason = false,
  submitText = t.confirm,
  danger = false,
  wide = false,
  disabled = false,
}: {
  title: string;
  children?: ReactNode;
  onSubmit: (input: {
    key: string;
    reason: string;
  }) => Promise<unknown> /* resolve false to keep the dialog open */;
  onClose: () => void;
  onStale?: () => Promise<unknown>;
  needReason?: boolean;
  submitText?: string;
  danger?: boolean;
  wide?: boolean;
  disabled?: boolean;
}) {
  const attempt = useAttemptKey();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [stale, setStale] = useState(false);
  const reasonId = useId();
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit({
        key: attempt.key,
        reason: reason.trim(),
      });
      attempt.renew();
      if (result !== false) onClose();
    } catch (e) {
      attempt.afterError(e);
      if (e instanceof ApiError && e.code === "STALE_ORDER") {
        setStale(true);
        attempt.renew();
        await onStale?.();
      }
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={title} onClose={onClose} wide={wide}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        {children}
        {needReason && (
          <label className="field" htmlFor={reasonId}>
            {t.reason}
            <textarea
              id={reasonId}
              required
              minLength={6}
              maxLength={400}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={reasonId + "-hint"}
            />
            <small id={reasonId + "-hint"} className="muted">
              {t.reasonHint}
            </small>
          </label>
        )}
        {error !== null && (
          <Note tone="bad">
            {error instanceof ApiError
              ? stale
                ? t.staleOrder
                : error.message
              : t.serviceUnavailable}
          </Note>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t.back}
          </button>
          <button
            className={"btn " + (danger ? "danger" : "primary")}
            disabled={busy || disabled}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : null}
            {stale ? t.refreshAndRetry : submitText}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Line chart with an optional comparison series; pure SVG, CSP-safe (no inline styles). */
export function LineChart({
  points,
  label,
}: {
  points: { x: string; y: number; prev?: number }[];
  label: string;
}) {
  const w = 640,
    h = 220,
    pad = 28;
  if (!points.length) return <Empty title="Немає даних за період" text="" />;
  const max = Math.max(1, ...points.map((p) => Math.max(p.y, p.prev ?? 0)));
  const x = (i: number) =>
    pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const path = (vals: number[]) =>
    vals
      .map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1))
      .join(" ");
  const cur = path(points.map((p) => p.y));
  const step = Math.max(1, Math.ceil(points.length / 7));
  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <line
          className="axis"
          x1={pad}
          x2={w - pad}
          y1={h - pad}
          y2={h - pad}
        />
        <path
          className="area"
          d={
            cur + ` L ${x(points.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`
          }
        />
        {points.some((p) => p.prev !== undefined) && (
          <path
            className="series prev"
            d={path(points.map((p) => p.prev ?? 0))}
          />
        )}
        <path className="series" d={cur} />
        {points.map((p, i) =>
          i % step === 0 ? (
            <text key={p.x} x={x(i)} y={h - 8} textAnchor="middle">
              {p.x}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="sr-only">
        {points.map((p) => `${p.x}: ${p.y}`).join("; ")}
      </figcaption>
    </figure>
  );
}
export function Bars({
  items,
}: {
  items: { label: string; value: number; text: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar" key={i.label}>
          <span>{i.label}</span>
          <strong className="num">{i.text}</strong>
          <div className="bar-track" aria-hidden="true">
            <div
              className="bar-fill"
              ref={(el) => {
                if (el) el.style.width = (i.value / max) * 100 + "%";
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
