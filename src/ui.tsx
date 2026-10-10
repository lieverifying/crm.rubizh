import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  X,
  AlertCircle,
  ArrowUpRight,
  Package,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Check,
  RefreshCw,
} from "lucide-react";
import type { Page } from "./api";
export const money = (v: number | string | undefined) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2,
  }).format(Number(v ?? 0));
const instant = (v: string) =>
  new Date(
    v.includes("T")
      ? v
      : v.length === 10
        ? v + "T00:00:00Z"
        : v.replace(" ", "T") + "Z",
  );
export const date = (v?: string, withTime = false) =>
  v
    ? new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Europe/Kyiv",
      }).format(instant(v))
    : "—";
export const time = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Kyiv",
      }).format(new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z"))
    : "—";
const names: Record<string, string> = {
  confirm: "Підтвердження замовлення",
  assign: "Призначення менеджера",
  invoice: "Платіжне посилання",
  shipments: "Нове відправлення",
  return: "Фізичне повернення",
  cancel: "Скасування",
  create: "Створення ТТН",
  refresh: "Оновлення tracking",
  reconcile: "Звірка з НП",
  "manual-reconcile": "Звірка з MonoPay",
  VERIFIED: "Підтверджено",
  ACCOUNT: "Профіль клієнта",
  ORDER_CONTACT: "Контакт замовлення",
  "note.append": "Додано нотатку",
  "order.assign": "Призначено менеджера",
  "order.confirm": "Замовлення підтверджено",
  "order.confirmation_quote": "Погоджено розрахунок",
  "payment.refund.request": "Запит повернення коштів",
  "payment.refund.result": "Результат повернення коштів",
  "shipment.create": "Створено ТТН",
  "return.transition": "Оновлено повернення",
  NEW: "Нове",
  WAITING_CONFIRMATION: "Підтвердження",
  CONFIRMED: "Підтверджено",
  CANCELLED: "Скасовано",
  COMPLETED: "Завершено",
  UNPAID: "Не оплачено",
  PAYMENT_PENDING: "Очікує оплати",
  PAID: "Оплачено",
  PARTIALLY_REFUNDED: "Частково повернено",
  REFUNDED: "Кошти повернено",
  NOT_READY: "Не готове",
  READY_TO_SHIP: "До відправки",
  TTN_CREATED: "ТТН створено",
  SHIPPED: "Відправлено",
  IN_TRANSIT: "У дорозі",
  DELIVERED: "Доставлено",
  LEGACY_REVIEW_REQUIRED: "Потрібна звірка",
  STATE_CONFLICT: "Конфлікт станів",
  SIZE_CONFIRMATION_REQUIRED: "Потрібне підтвердження розміру",
  CONFIRMATION_REQUIRED: "Потрібне підтвердження наявності",
  PREORDER: "Передзамовлення",
  ORDER_ON_REQUEST: "Під замовлення",
  PRICE_CHANGED: "Ціна змінилася",
  SKU_UNAVAILABLE: "SKU недоступний",
  AVAILABILITY_CHANGED: "Наявність змінилася",
  PAYMENT_NOT_ALLOWED: "Оплата поки недоступна",
  SENDER_PROFILE_INCOMPLETE: "Профіль відправника не підтверджено",
  REQUESTED: "Запитано",
  APPROVED: "Погоджено",
  RECEIVED: "Фізично отримано",
  REFUND_PENDING: "Очікує повернення коштів",
  CLOSED: "Закрито",
  REJECTED: "Відхилено",
  draft: "Чернетка",
  creating: "Створюється",
  unknown: "Потрібна звірка",
  error: "Помилка",
  created: "Створено",
  processing: "Обробляється",
  success: "Підтверджено",
  sent: "У дорозі",
  delivered: "Доставлено",
  returned: "Повернення",
  cancelled: "Скасовано",
  expired: "Строк минув",
  failure: "Відхилено",
  reversed: "Повернено",
  hold: "Утримання",
  awaiting_webhook: "Очікує підтвердження банку",
  IN_STOCK: "В наявності",
  OWNER: "Власник",
  MANAGER: "Менеджер",
  LOGISTICS: "Логістика",
  READ_ONLY: "Перегляд",
  KEEP_COMMITTED: "Зберегти складське зобов’язання",
  PIM_RECONCILIATION_REQUIRED: "Звірка залишку з PIM",
  PENDING: "Рішення не прийнято",
  STALE_ORDER: "Замовлення змінилося",
  REFUND_LIMIT_EXCEEDED: "Сума перевищує доступний залишок",
  REFUND_RECONCILIATION_REQUIRED: "Потрібна звірка повернення з банком",
  LAST_OWNER_REQUIRED: "Має залишитися активний власник",
  INVALID_STATE_TRANSITION: "Цей перехід недоступний",
  INVENTORY_DECISION_REQUIRED: "Власник має прийняти рішення щодо залишку",
};
export const label = (s: string | null | undefined) =>
  s ? (names[s] ?? s) : "Потрібна звірка";
export function Badge({ value }: { value: string | null | undefined }) {
  const good = [
    "PAID",
    "CONFIRMED",
    "DELIVERED",
    "COMPLETED",
    "success",
    "delivered",
    "CLOSED",
    "IN_STOCK",
  ];
  const bad = [
    "STATE_CONFLICT",
    "unknown",
    "error",
    "returned",
    "LEGACY_REVIEW_REQUIRED",
  ];
  const warn = [
    "WAITING_CONFIRMATION",
    "UNPAID",
    "PAYMENT_PENDING",
    "REQUESTED",
    "REFUND_PENDING",
    "PREORDER",
    "processing",
  ];
  const tone = good.includes(value ?? "")
    ? "success"
    : bad.includes(value ?? "")
      ? "danger"
      : warn.includes(value ?? "")
        ? "warning"
        : "neutral";
  return (
    <span className={"badge " + tone}>
      <i />
      {label(value)}
    </span>
  );
}
export function Empty({
  title = "Нічого не знайдено",
  description = "Спробуйте змінити пошук або фільтри.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Package size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} /> Завантажуємо дані…
    </div>
  );
}
export function ErrorBox({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>Не вдалося завершити дію</strong>
        <p>
          {((error as Error & { code?: string }).code &&
            names[(error as Error & { code: string }).code]) ||
            error.message}
        </p>
      </div>
      {onRetry && (
        <button className="btn small" onClick={onRetry}>
          <RefreshCw size={14} />
          Повторити
        </button>
      )}
    </div>
  );
}
export function Pager({
  page,
  onChange,
}: {
  page: Page;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {page.total} записів ·{" "}
        {page.total ? (page.page - 1) * page.limit + 1 : 0}–
        {Math.min(page.page * page.limit, page.total)}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Попередня сторінка"
          disabled={page.page <= 1}
          onClick={() => onChange(page.page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {page.page} / {Math.max(page.pages, 1)}
        </span>
        <button
          className="icon-btn"
          aria-label="Наступна сторінка"
          disabled={page.page >= page.pages}
          onClick={() => onChange(page.page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", onKey);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={"dialog " + (wide ? "wide" : "")}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Закрити" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="drawer-mode">
      <Dialog title={title} onClose={onClose} wide>
        <div className="drawer-body">{children}</div>
      </Dialog>
    </div>
  );
}
export function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function useDebounce<T>(value: T, delay = 250) {
  const [v, set] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => set(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div className="toast" role="status">
      <Check size={17} />
      {message}
      <button
        className="icon-btn"
        onClick={onClose}
        aria-label="Закрити повідомлення"
      >
        <X size={16} />
      </button>
    </div>
  );
}
export { ArrowUpRight };
