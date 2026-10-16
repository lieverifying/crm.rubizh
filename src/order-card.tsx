import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Phone,
  RefreshCw,
} from "lucide-react";
import type { AssigneeList, Order, ProductDetail } from "./contract.gen";
import {
  api,
  ApiError,
  copy,
  date,
  download,
  money,
  params,
  telHref,
  useCan,
  useWorkspace,
  safeBankUrl,
} from "./lib";
import {
  ActionDialog,
  Empty,
  ErrorBox,
  Loading,
  Note,
  Panel,
  Pill,
  Status3,
} from "./kit";
import { label, t } from "./i18n";

type Line = {
  line_no: number;
  name: string;
  sku: string;
  product_id: string;
  size: string;
  color: string;
  qty: number;
  unit_minor: number | null;
  amount_minor: number | null;
  supplier_code: string;
  supplier_name: string;
  stock_check: string | null;
  stock_note: string;
  in_parcels: number;
  requires_confirmation: boolean;
  availability: string | null;
  image: string | null;
};
type Parcel = {
  id: number;
  supplier_code: string;
  supplier_name: string;
  status: string;
  tracking_number: string | null;
  lines: { line_no: number; qty: number }[];
  error: string;
};
type Finance = {
  goods_minor: number;
  discount_minor: number;
  discount_type: string | null;
  promo_code: string | null;
  shipping_minor: number;
  shipping_note: string;
  total_minor: number;
  paid_minor: number;
  refunded_minor: number;
  refundable_minor: number;
  payment_method: string;
  payment_due: string | null;
  paid_at: string | null;
  invoices: {
    id: number;
    invoice_id: string | null;
    status: string;
    amount_minor: number;
    page_url: string;
    created_at: string;
  }[];
  refunds: {
    id: number;
    amount_minor: number;
    status: string;
    reason: string;
    updated_at: string;
  }[];
};
type Card = Omit<
  Order,
  "lines" | "parcels" | "finance" | "notes" | "history" | "tasks"
> & {
  lines: Line[];
  parcels: Parcel[];
  finance: Finance | null;
  contact: Record<string, unknown>;
  notes: {
    id: number;
    body: string;
    author: string | null;
    created_at: string;
  }[];
  history: {
    at: string;
    source: string;
    action: string;
    actor: string | null;
    reason: string;
  }[];
  tasks: {
    id: number;
    title: string;
    state: string;
    due_at: string | null;
    assignee_name?: string;
  }[];
  problem: { reason: string } | null;
  sku_candidates?: {
    line_no: number;
    label: string;
    skus: { sku: string; label: string }[];
  }[];
  invoice?: { url: string; invoice_id: string } | null;
  remaining?: Record<string, { qty: number }>;
};
type DialogState = { kind: string; line?: Line; parcel?: Parcel } | null;

export function OrderCard() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const client = useQueryClient();
  const can = useCan();
  const { notify } = useWorkspace();
  const q = useQuery({
    queryKey: ["order", Number(id)],
    queryFn: ({ signal }) => api<Card>("/orders/" + id, undefined, { signal }),
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => {
    const d = sp.get("do");
    if (d && q.data?.actions.includes(d)) {
      setDialog({ kind: d });
      setSp(
        (p) => {
          p.delete("do");
          return p;
        },
        { replace: true },
      );
    }
  }, [sp, q.data]);
  if (q.isPending) return <Loading rows={8} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const o = q.data;
  const busy = q.isFetching; // M-16: actions wait for the fresh order after every change
  const refresh = () => q.refetch();
  /** Every action names the version it was prepared on and its own attempt key; the answer is the updated order. */
  const act = async (
    path: string,
    body: Record<string, unknown>,
    key: string,
    success = t.done,
  ) => {
    const next = await api<Card>(
      path,
      { ...body, expected_version: o.version },
      { idem: key },
    );
    client.setQueryData(["order", o.id], next);
    void client.invalidateQueries({ queryKey: ["orders"] });
    void client.invalidateQueries({ queryKey: ["counters"] });
    notify(success);
    return next;
  };
  const has = (a: string) => o.actions.includes(a);
  const open = (kind: string, extra: Partial<NonNullable<DialogState>> = {}) =>
    setDialog({ kind, ...extra });
  const close = () => setDialog(null);
  const primary = o.primary_action;
  const reveal = async () => {
    try {
      setPhone(
        (
          await api<{ phone: string | null }>(
            `/customers/${encodeURIComponent(String(o.customer.id))}/phone`,
            {},
          )
        ).phone,
      );
    } catch (e) {
      notify(e instanceof ApiError ? e.message : t.serviceUnavailable, "error");
    }
  };
  return (
    <>
      <Link className="btn ghost small" to="/orders">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.orders}
      </Link>
      <div className="order-head">
        <div className="stack">
          <h1>{o.number}</h1>
          <span className="sub">
            {date(o.created_at, true)} · {t.channel[o.channel ?? "web"]} ·{" "}
            {(o.assigned_manager as { name?: string } | null)?.name ??
              "менеджера не призначено"}
          </span>
          <Status3 display={o.display} captions />
        </div>
        <button className="btn" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw
            size={16}
            className={busy ? "spin" : ""}
            aria-hidden="true"
          />{" "}
          Оновити
        </button>
      </div>
      {o.problem && <Note tone="bad">Проблема: {o.problem.reason}</Note>}
      {(o.attention ?? []).filter((a) => a !== "PROBLEM").length > 0 && (
        <div className="row" aria-label="Потребує уваги">
          {o.attention
            .filter((a) => a !== "PROBLEM")
            .map((a) => (
              <Pill
                key={a}
                code={a === "READY_TO_SHIP" ? "AWAITING" : "NEEDS_REVIEW"}
              >
                {t.attention[a] ?? a}
              </Pill>
            ))}
        </div>
      )}
      <div className="actions-bar" aria-label="Дії із замовленням">
        {[
          "assign_self",
          "assign",
          "confirm",
          "invoice",
          "accept_invoice",
          "packing",
          "shipment",
          "complete",
          "delivery_edit",
          "return",
          "reconcile_not_created",
          "reconcile_link",
          "problem",
          "cancel",
        ]
          .filter(has)
          .map((a) => (
            <button
              key={a}
              className={
                "btn " +
                (a === primary ? "primary" : a === "cancel" ? "danger" : "")
              }
              disabled={busy}
              onClick={() => open(a)}
            >
              {a === "problem" && o.problem ? "Зняти проблему" : t.actions[a]}
            </button>
          ))}
        {has("refund") &&
          o.finance?.invoices.find((i) => i.status === "success") && (
            <Link
              className="btn"
              to={
                "/payments/" +
                o.finance.invoices.find((i) => i.status === "success")!.id
              }
            >
              {t.actions.refund}
            </Link>
          )}
        {o.invoice_pdf?.available && (
          <button
            className="btn"
            onClick={() =>
              download("/orders/" + o.id + "/invoice-pdf").catch((e) =>
                notify(
                  e instanceof ApiError ? e.message : t.serviceUnavailable,
                  "error",
                ),
              )
            }
          >
            <Download size={16} aria-hidden="true" /> Завантажити рахунок (PDF)
          </button>
        )}
      </div>
      {o.invoice_pdf &&
        !o.invoice_pdf.available &&
        o.invoice_pdf.reason === "VAT_NOTE_MISSING" && (
          <p className="callout warning" role="status">
            {o.invoice_pdf.message}
          </p>
        )}
      <div className="grid-2">
        <div className="stack">
          <Panel
            title="Товари"
            meta={<span className="muted">{o.lines.length} поз.</span>}
          >
            {o.lines.map((l) => (
              <div className="line" key={l.line_no}>
                <div className="thumb" aria-hidden="true">
                  {l.image ? (
                    <img src={l.image} alt="" loading="lazy" />
                  ) : (
                    l.name.slice(0, 1)
                  )}
                </div>
                <div>
                  <strong>{l.name}</strong>
                  <div className="cell-sub">
                    {l.sku || "розмір уточнюється"} ·{" "}
                    {[l.color, l.size].filter(Boolean).join(" · ")} · {l.qty}{" "}
                    шт.
                  </div>
                  <div className="row">
                    {l.supplier_name ? (
                      <Pill code="">{l.supplier_name}</Pill>
                    ) : (
                      <Pill code="NEEDS_REVIEW">без постачальника</Pill>
                    )}
                    {l.stock_check === "CONFIRMED" && (
                      <Pill code="PAID">залишок підтверджено</Pill>
                    )}
                    {l.stock_check === "OUT_OF_STOCK" && (
                      <Pill code="FAILED">немає в наявності</Pill>
                    )}
                    {l.requires_confirmation && !l.stock_check && (
                      <Pill code="AWAITING">потребує підтвердження</Pill>
                    )}
                    {l.in_parcels > 0 && (
                      <span className="cell-sub">
                        у посилках: {l.in_parcels}
                      </span>
                    )}
                  </div>
                  <div className="row">
                    {has("line_stock") && (
                      <>
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => open("line_stock_yes", { line: l })}
                        >
                          Є у постачальника
                        </button>
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => open("line_stock_no", { line: l })}
                        >
                          Немає
                        </button>
                      </>
                    )}
                    {has("line_replace") &&
                      l.stock_check === "OUT_OF_STOCK" && (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => open("line_replace", { line: l })}
                        >
                          {t.actions.line_replace}
                        </button>
                      )}
                    {has("line_remove") && (
                      <button
                        className="btn small danger"
                        disabled={busy}
                        onClick={() => open("line_remove", { line: l })}
                      >
                        {t.actions.line_remove}
                      </button>
                    )}
                    {has("line_supplier") && !l.supplier_code && (
                      <button
                        className="btn small"
                        disabled={busy}
                        onClick={() => open("line_supplier", { line: l })}
                      >
                        {t.actions.line_supplier}
                      </button>
                    )}
                  </div>
                </div>
                <strong className="num">{money(l.amount_minor)}</strong>
              </div>
            ))}
            {o.finance && (
              <div className="totals">
                {can("order.finance.view") && (
                  <div>
                    <span>Вартість товарів</span>
                    <span className="num">{money(o.finance.goods_minor)}</span>
                  </div>
                )}
                {can("order.finance.view") && (
                  <>
                    <div>
                      <span>
                        Знижка
                        {o.finance.discount_type
                          ? ` (${t.discount[o.finance.discount_type]}${o.finance.promo_code ? " " + o.finance.promo_code : ""})`
                          : ""}
                      </span>
                      <span className="num">
                        −{money(o.finance.discount_minor)}
                      </span>
                    </div>
                    <div>
                      <span>Доставка</span>
                      <span className="sub">
                        {o.finance.shipping_minor
                          ? money(o.finance.shipping_minor)
                          : o.finance.shipping_note}
                      </span>
                    </div>
                  </>
                )}
                <div className="grand">
                  <span>Разом</span>
                  <span className="num">{money(o.finance.total_minor)}</span>
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Постачальники та наявність">
            <div className="panel-body stack">
              {groupBySupplier(o.lines).map(([name, lines]) => (
                <div key={name} className="parcel">
                  <strong>{name || "Без постачальника"}</strong>
                  <span className="sub">
                    {lines
                      .map((l) => `${l.sku || l.name} × ${l.qty}`)
                      .join(", ")}
                  </span>
                  <span>
                    {lines.every((l) => l.stock_check === "CONFIRMED") ? (
                      <Pill code="PAID">залишок підтверджено</Pill>
                    ) : lines.some((l) => l.stock_check === "OUT_OF_STOCK") ? (
                      <Pill code="FAILED">є позиції без наявності</Pill>
                    ) : (
                      <Pill code="AWAITING">не підтверджено</Pill>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Посилки"
            meta={
              has("shipment") ? (
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() => open("shipment")}
                >
                  {t.actions.shipment}
                </button>
              ) : undefined
            }
          >
            <div className="panel-body stack">
              {!o.parcels.length && <p className="muted">Посилок ще немає.</p>}
              {o.parcels.map((p) => (
                <div className="parcel" key={p.id}>
                  <div className="row">
                    <strong>{p.supplier_name}</strong>
                    <Pill code={p.status}>{label(t.shipment, p.status)}</Pill>
                    <span className="spacer" />
                    {p.tracking_number && (
                      <button
                        className="btn small"
                        onClick={async () =>
                          notify(
                            (await copy(p.tracking_number!))
                              ? t.copied + ": ТТН"
                              : t.copyFailed,
                          )
                        }
                      >
                        <Copy size={14} aria-hidden="true" /> ТТН{" "}
                        {p.tracking_number}
                      </button>
                    )}
                  </div>
                  <span className="sub">
                    {p.lines
                      .map((l) => `рядок ${l.line_no + 1} × ${l.qty}`)
                      .join(", ")}
                  </span>
                  {p.error && <Note tone="bad">{p.error}</Note>}
                  {can("shipment.manage") && (
                    <div className="row">
                      {p.status === "draft" && (
                        <button
                          className="btn small primary"
                          disabled={busy}
                          onClick={() => open("ttn_create", { parcel: p })}
                        >
                          Створити ТТН
                        </button>
                      )}
                      {["created", "sent"].includes(p.status) && (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => open("ttn_refresh", { parcel: p })}
                        >
                          Оновити статус
                        </button>
                      )}
                      {["draft", "error", "created"].includes(p.status) && (
                        <button
                          className="btn small danger"
                          disabled={busy}
                          onClick={() => open("ttn_cancel", { parcel: p })}
                        >
                          {p.status === "created"
                            ? "Видалити ТТН"
                            : "Видалити чернетку"}
                        </button>
                      )}
                      {["unknown", "creating"].includes(p.status) && (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => open("ttn_reconcile", { parcel: p })}
                        >
                          Звірити з НП
                        </button>
                      )}
                      {p.tracking_number &&
                        ["created", "sent"].includes(p.status) && (
                          <button
                            className="btn small"
                            disabled={busy}
                            onClick={() => open("ttn_notify", { parcel: p })}
                          >
                            Повідомити клієнта
                          </button>
                        )}
                      {can("shipment.resolve_unknown") &&
                        ["unknown", "creating"].includes(p.status) && (
                          <button
                            className="btn small"
                            disabled={busy}
                            onClick={() => open("ttn_resolve", { parcel: p })}
                          >
                            Розбір ТТН
                          </button>
                        )}
                      {can("shipment.manual_deliver") &&
                        ["sent", "manual"].includes(p.status) &&
                        p.tracking_number && (
                          <button
                            className="btn small"
                            disabled={busy}
                            onClick={() => open("ttn_deliver", { parcel: p })}
                          >
                            Підтвердити доставку вручну
                          </button>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
          <Notes order={o} />
        </div>
        <div className="stack">
          <Panel title="Покупець">
            <dl className="panel-body dl">
              <dt>Ім’я</dt>
              <dd>
                <Link
                  className="link"
                  to={"/customers/" + encodeURIComponent(String(o.customer.id))}
                >
                  {String(o.customer.name || "—")}
                </Link>
              </dd>
              <dt>Телефон</dt>
              <dd>
                {phone ? (
                  <a className="link" href={telHref(phone)}>
                    <Phone size={14} aria-hidden="true" /> {phone}
                  </a>
                ) : (
                  <>
                    {String(o.customer.phone_masked ?? "—")}{" "}
                    {can("customer.phone.full") && (
                      <button
                        className="btn small ghost"
                        onClick={() => void reveal()}
                      >
                        Показати
                      </button>
                    )}
                  </>
                )}
              </dd>
              <dt>Email</dt>
              <dd>{String(o.customer.email || "—")}</dd>
              <dt>Отримувач</dt>
              <dd>{String(o.contact.recipient || o.contact.name || "—")}</dd>
              <dt>Доставка</dt>
              <dd>
                {String(o.contact.city ?? "")} ·{" "}
                {String(o.contact.address ?? "—")}
              </dd>
            </dl>
          </Panel>
          {o.finance && can("order.finance.view") && (
            <Panel title="Фінанси">
              <dl className="panel-body dl">
                <dt>Спосіб оплати</dt>
                <dd>
                  {o.finance.payment_method === "invoice"
                    ? "Рахунок ФОП"
                    : "Картка monobank"}
                </dd>
                <dt>Оплачено</dt>
                <dd className="num">
                  {money(o.finance.paid_minor)}
                  {o.finance.paid_at
                    ? " · " + date(o.finance.paid_at, true)
                    : ""}
                </dd>
                {o.finance.refunded_minor > 0 && (
                  <>
                    <dt>Повернено</dt>
                    <dd className="num">{money(o.finance.refunded_minor)}</dd>
                  </>
                )}
                {o.finance.payment_due && !o.finance.paid_minor && (
                  <>
                    <dt>Оплатити до</dt>
                    <dd>{date(o.finance.payment_due, true)}</dd>
                  </>
                )}
              </dl>
              {o.finance.invoices.map((i) => (
                <div className="line" key={i.id}>
                  <span className="thumb" aria-hidden="true">
                    ₴
                  </span>
                  <span>
                    <Link className="link" to={"/payments/" + i.id}>
                      Рахунок MonoPay
                    </Link>
                    <small className="cell-sub">
                      {date(i.created_at, true)} · {label(t.invoice, i.status)}
                    </small>
                    {safeBankUrl(i.page_url) && (
                      <span className="row">
                        <button
                          className="btn small"
                          onClick={async () =>
                            notify(
                              (await copy(i.page_url))
                                ? t.copied
                                : t.copyFailed,
                            )
                          }
                        >
                          <Copy size={14} aria-hidden="true" /> Скопіювати
                          посилання
                        </button>
                        <a
                          className="btn small"
                          href={safeBankUrl(i.page_url)!}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <ExternalLink size={14} aria-hidden="true" /> Відкрити
                        </a>
                      </span>
                    )}
                  </span>
                  <strong className="num">{money(i.amount_minor)}</strong>
                </div>
              ))}
            </Panel>
          )}
          <Panel title="Історія">
            <div className="timeline">
              {o.history.length ? (
                o.history.map((h, i) => (
                  <div className="timeline-item" key={i}>
                    <i aria-hidden="true" />
                    <div>
                      <strong>{t.history[h.action] ?? h.action}</strong>
                      <small className="cell-sub">
                        {date(h.at, true)}
                        {h.actor ? " · " + h.actor : ""}
                        {h.reason ? " · " + h.reason : ""}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Подій ще немає.</p>
              )}
            </div>
          </Panel>
          <Tasks order={o} />
        </div>
      </div>
      {primary && (
        <div className="sticky-action">
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => open(primary)}
          >
            {t.actions[primary]}
          </button>
        </div>
      )}
      {dialog && (
        <OrderDialogs
          o={o}
          dialog={dialog}
          act={act}
          close={close}
          refresh={refresh}
        />
      )}
    </>
  );
}

function groupBySupplier(lines: Line[]): [string, Line[]][] {
  const m = new Map<string, Line[]>();
  for (const l of lines)
    m.set(l.supplier_name, [...(m.get(l.supplier_name) ?? []), l]);
  return Array.from(m.entries());
}

type Act = (
  path: string,
  body: Record<string, unknown>,
  key: string,
  success?: string,
) => Promise<Card>;
function OrderDialogs({
  o,
  dialog,
  act,
  close,
  refresh,
}: {
  o: Card;
  dialog: NonNullable<DialogState>;
  act: Act;
  close: () => void;
  refresh: () => Promise<unknown>;
}) {
  const base = "/orders/" + o.id;
  const common = { onClose: close, onStale: refresh };
  const l = dialog.line,
    p = dialog.parcel;
  switch (dialog.kind) {
    case "assign_self":
      return (
        <ActionDialog
          {...common}
          title={t.actions.assign_self}
          needReason={!!o.assigned_manager}
          onSubmit={({ key, reason }) =>
            act(
              base + "/assign",
              reason ? { reason } : {},
              key,
              "Замовлення у вашій роботі",
            )
          }
        >
          <p>
            {o.assigned_manager
              ? "Замовлення вже має менеджера — вкажіть причину перепризначення."
              : `Закріпити ${o.number} за вами?`}
          </p>
        </ActionDialog>
      );
    case "assign":
      return <AssignDialog o={o} act={act} common={common} />;
    case "confirm":
      return <ConfirmDialog o={o} act={act} common={common} />;
    case "line_stock_yes":
    case "line_stock_no": {
      const yes = dialog.kind === "line_stock_yes";
      return (
        <ActionDialog
          {...common}
          title={yes ? "Залишок підтверджено" : "Немає в наявності"}
          onSubmit={({ key, reason }) =>
            act(
              `${base}/lines/${l!.line_no}/stock`,
              { status: yes ? "CONFIRMED" : "OUT_OF_STOCK", note: reason },
              key,
            )
          }
        >
          <p>
            {l!.name} · {l!.sku} × {l!.qty}
          </p>
          <p className="muted">
            {yes
              ? "Постачальник підтвердив наявність цієї позиції."
              : "Далі: замініть позицію (за згодою клієнта), приберіть її або скасуйте замовлення."}
          </p>
        </ActionDialog>
      );
    }
    case "line_remove":
      return (
        <ActionDialog
          {...common}
          danger
          title={t.actions.line_remove}
          needReason
          submitText="Прибрати"
          onSubmit={({ key, reason }) =>
            act(
              `${base}/lines/${l!.line_no}/remove`,
              { reason },
              key,
              "Позицію прибрано, суму перераховано",
            )
          }
        >
          <p>
            {l!.name} × {l!.qty}. Сума замовлення буде перерахована сервером за
            чинними цінами.
          </p>
        </ActionDialog>
      );
    case "line_replace":
      return <ReplaceDialog o={o} line={l!} act={act} common={common} />;
    case "line_supplier":
      return <SupplierDialog o={o} line={l!} act={act} common={common} />;
    case "invoice":
      return <InvoiceDialog o={o} act={act} common={common} />;
    case "cancel":
      return (
        <ActionDialog
          {...common}
          danger
          title={t.actions.cancel}
          needReason
          submitText="Скасувати замовлення"
          onSubmit={({ key, reason }) =>
            act(
              base + "/cancel",
              { reason },
              key,
              "Замовлення скасовано, резерв знято",
            )
          }
        >
          <p>
            Скасування можливе лише до оплати. Резерв буде знято, відкритий
            рахунок закрито.
          </p>
        </ActionDialog>
      );
    case "problem":
      return (
        <ActionDialog
          {...common}
          title={o.problem ? "Зняти позначку проблеми" : "Позначити проблему"}
          needReason
          onSubmit={({ key, reason }) =>
            act(base + "/problem", { flag: !o.problem, reason }, key)
          }
        >
          <p>
            {o.problem
              ? "Проблему вирішено?"
              : "Замовлення потрапить у вкладку «Проблемні», власник отримає сповіщення."}
          </p>
        </ActionDialog>
      );
    case "packing":
      return (
        <ActionDialog
          {...common}
          title={t.actions.packing}
          onSubmit={({ key }) =>
            act(base + "/packing", {}, key, "Передано в комплектацію")
          }
        >
          <p>
            Оплачене підтверджене замовлення перейде в статус «у комплектації».
          </p>
        </ActionDialog>
      );
    case "complete":
      return (
        <ActionDialog
          {...common}
          title={t.actions.complete}
          onSubmit={({ key }) =>
            act(base + "/complete", {}, key, "Замовлення завершено")
          }
        >
          <p>Усі посилки доставлено. Завершити замовлення?</p>
        </ActionDialog>
      );
    case "shipment":
      return <ShipmentDialog o={o} act={act} common={common} />;
    case "delivery_edit":
      return <DeliveryDialog o={o} act={act} common={common} />;
    case "return":
      return <ReturnDialog o={o} common={common} />;
    case "accept_invoice":
      return <AcceptInvoiceDialog o={o} act={act} common={common} />;
    case "reconcile_not_created":
      return (
        <ActionDialog
          {...common}
          title={t.actions.reconcile_not_created}
          needReason
          onSubmit={({ key, reason }) =>
            act(
              base + "/reconcile-not-created",
              { reason },
              key,
              "Спробу оплати закрито: рахунок у банку не створено",
            )
          }
        >
          <Note tone="info">
            Перевірте в кабінеті monobank, що рахунку з цим reference немає.
            Після цього спроба отримає статус «неуспішно», і можна створити нове
            посилання.
          </Note>
        </ActionDialog>
      );
    case "reconcile_link":
      return <LinkInvoiceDialog o={o} act={act} common={common} />;
    case "ttn_create":
      return (
        <ActionDialog
          {...common}
          title="Створити ТТН"
          onSubmit={({ key }) =>
            act(`/shipments/${p!.id}/create`, {}, key, "ТТН створено")
          }
        >
          <p>
            Відправник — профіль постачальника «{p!.supplier_name}». Одержувач —
            з замовлення. Оплата вже отримана, тож ТТН без грошового переказу.
          </p>
        </ActionDialog>
      );
    case "ttn_refresh":
      return (
        <ActionDialog
          {...common}
          title="Оновити статус у НП"
          onSubmit={({ key }) =>
            act(`/shipments/${p!.id}/refresh`, {}, key, "Статус оновлено")
          }
        >
          <p>Статуси доставки змінюються лише за відповіддю Нової пошти.</p>
        </ActionDialog>
      );
    case "ttn_reconcile":
      return (
        <ActionDialog
          {...common}
          title="Звірити з НП"
          onSubmit={({ key }) => act(`/shipments/${p!.id}/reconcile`, {}, key)}
        >
          <p>Шукаємо ТТН із маркером цієї посилки в кабінеті НП.</p>
        </ActionDialog>
      );
    case "ttn_cancel":
      return (
        <ActionDialog
          {...common}
          danger
          title={p!.status === "created" ? "Видалити ТТН" : "Видалити чернетку"}
          onSubmit={({ key }) => act(`/shipments/${p!.id}/cancel`, {}, key)}
        >
          <p>
            {p!.status === "created"
              ? "ТТН ще не передана перевізнику — її буде видалено в НП, постачальник отримає повідомлення."
              : "Чернетку посилки буде видалено."}
          </p>
        </ActionDialog>
      );
    case "ttn_notify":
      return (
        <ActionDialog
          {...common}
          title="Повідомити клієнта"
          onSubmit={async ({ key }) => {
            await api(`/shipments/${p!.id}/notify`, {}, { idem: key });
          }}
        >
          <p>Клієнт отримає SMS із номером ТТН {p!.tracking_number}.</p>
        </ActionDialog>
      );
    case "ttn_resolve":
      return <ResolveDialog parcel={p!} act={act} common={common} />;
    case "ttn_deliver":
      return (
        <ActionDialog
          {...common}
          title="Підтвердити доставку вручну"
          needReason
          onSubmit={({ key, reason }) =>
            act(
              `/shipments/${p!.id}/deliver-manually`,
              { reason },
              key,
              "Доставку підтверджено вручну",
            )
          }
        >
          <Note>
            Виняток: звичайно статус «доставлено» встановлює лише Нова пошта. В
            історії буде позначка «вручну».
          </Note>
        </ActionDialog>
      );
    default:
      return null;
  }
}
type Common = { onClose: () => void; onStale: () => Promise<unknown> };

function AssignDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const people = useQuery({
    queryKey: ["assignees"],
    queryFn: () => api<AssigneeList>("/staff/assignees"),
  });
  const [staff, setStaff] = useState("");
  const other = !!o.assigned_manager;
  return (
    <ActionDialog
      {...common}
      title={t.actions.assign}
      needReason={other}
      onSubmit={({ key, reason }) =>
        act(
          "/orders/" + o.id + "/assign",
          { staff_id: staff || null, ...(reason ? { reason } : {}) },
          key,
        )
      }
    >
      <label className="field">
        Менеджер
        <select
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          required
        >
          <option value="">Оберіть</option>
          {(
            people.data?.rows as { id: string; name: string }[] | undefined
          )?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
    </ActionDialog>
  );
}

function ConfirmDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const can = useCan();
  const [available, setAvailable] = useState(false),
    [extra, setExtra] = useState(false),
    [resolution, setResolution] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<{
    quote_hash?: string;
    quote?: { total: number };
    old_total?: number;
  } | null>(null);
  const suppliers = new Set(o.lines.map((l) => l.supplier_code)).size;
  return (
    <ActionDialog
      {...common}
      wide
      title={t.actions.confirm}
      needReason={!!conflict}
      submitText={conflict ? "Погодити нову ціну й підтвердити" : t.confirm}
      disabled={!!conflict && !can("order.price_override")}
      onSubmit={async ({ key, reason }) => {
        try {
          await act(
            "/orders/" + o.id + "/confirm",
            {
              availability_confirmed: available,
              extra_delivery_agreed: extra,
              resolution,
              ...(conflict
                ? { approval: { quote_hash: conflict.quote_hash, reason } }
                : {}),
            },
            key,
            "Замовлення підтверджено",
          );
        } catch (e) {
          if (e instanceof ApiError && e.code === "PRICE_CHANGED")
            setConflict(e.details as typeof conflict);
          throw e;
        }
      }}
    >
      <p>
        Сервер ще раз перевірить SKU, ціну та наявність. Якщо ціна змінилася —
        підтвердження зупиниться з поясненням.
      </p>
      {(o.sku_candidates ?? []).map((c) => (
        <label className="field" key={c.line_no}>
          Позиція {c.line_no + 1}: {c.label}
          <select
            required
            value={resolution[c.line_no] ?? ""}
            onChange={(e) =>
              setResolution((v) => ({ ...v, [c.line_no]: e.target.value }))
            }
          >
            <option value="">Оберіть реальний SKU</option>
            {c.skus.map((s) => (
              <option key={s.sku} value={s.sku}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="check">
        <input
          type="checkbox"
          required
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
        />{" "}
        Наявність і комплектацію всіх позицій підтверджено
      </label>
      {suppliers > 1 && (
        <label className="check">
          <input
            type="checkbox"
            checked={extra}
            onChange={(e) => setExtra(e.target.checked)}
          />{" "}
          Клієнт погодив окремі посилки від різних постачальників
        </label>
      )}
      {conflict && (
        <Note tone="bad">
          Ціна змінилася: було{" "}
          {money(Math.round((conflict.old_total ?? 0) * 100))}, зараз{" "}
          {money(Math.round((conflict.quote?.total ?? 0) * 100))}.
          {can("order.price_override")
            ? " Погодьте нову суму з клієнтом і вкажіть причину."
            : " Погодити нову ціну може лише власник — передайте замовлення власнику."}
        </Note>
      )}
    </ActionDialog>
  );
}

function ReplaceDialog({
  o,
  line,
  act,
  common,
}: {
  o: Card;
  line: Line;
  act: Act;
  common: Common;
}) {
  const product = useQuery({
    queryKey: ["product", line.product_id],
    queryFn: () =>
      api<ProductDetail>("/products/" + encodeURIComponent(line.product_id)),
  });
  const [sku, setSku] = useState(""),
    [agreed, setAgreed] = useState(false),
    [quote, setQuote] = useState<number | null>(null);
  return (
    <ActionDialog
      {...common}
      title={t.actions.line_replace}
      needReason
      submitText={
        quote === null ? "Перевірити ціну" : `Замінити (разом ${money(quote)})`
      }
      onSubmit={async ({ key, reason }) => {
        try {
          await act(
            `/orders/${o.id}/lines/${line.line_no}/replace`,
            {
              sku,
              customer_agreed: true,
              reason,
              expected_total_minor: quote ?? o.total_minor,
            },
            key,
            "Позицію замінено",
          );
        } catch (e) {
          if (e instanceof ApiError && e.code === "PRICE_CHANGED")
            setQuote(Number(e.details.quote_total_minor));
          throw e;
        }
      }}
    >
      <p>
        Було: {line.name} · {line.sku}. Ціну нової позиції визначає сервер; якщо
        сума зміниться, її треба погодити з клієнтом.
      </p>
      <label className="field">
        Новий SKU тієї ж моделі
        <select
          required
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setQuote(null);
          }}
        >
          <option value="">Оберіть</option>
          {(
            product.data?.variants as
              | {
                  sku: string;
                  pim_size_display?: string;
                  color?: string;
                  availability?: string;
                }[]
              | undefined
          )
            ?.filter((v) => v.sku !== line.sku)
            .map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.sku} · {v.pim_size_display} · {v.color} · {v.availability}
              </option>
            ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />{" "}
        Клієнт погодив заміну
      </label>
    </ActionDialog>
  );
}

function SupplierDialog({
  o,
  line,
  act,
  common,
}: {
  o: Card;
  line: Line;
  act: Act;
  common: Common;
}) {
  const list = useQuery({
    queryKey: ["suppliers"],
    queryFn: () =>
      api<{ rows: { code: string; name: string }[] }>("/suppliers"),
  });
  const [code, setCode] = useState("");
  return (
    <ActionDialog
      {...common}
      title={t.actions.line_supplier}
      needReason
      onSubmit={({ key, reason }) =>
        act(
          `/orders/${o.id}/lines/${line.line_no}/supplier`,
          { supplier_code: code, reason },
          key,
        )
      }
    >
      <p>
        {line.name} · {line.sku}: PIM не вказав постачальника.
      </p>
      <label className="field">
        Постачальник
        <select required value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Оберіть</option>
          {list.data?.rows.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </ActionDialog>
  );
}

function InvoiceDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const { notify } = useWorkspace();
  const [url, setUrl] = useState<string | null>(null);
  if (url)
    return (
      <ActionDialog
        {...common}
        title="Посилання на оплату"
        submitText="Скопіювати й закрити"
        onSubmit={async () => {
          notify((await copy(url)) ? t.copied : t.copyFailed);
        }}
      >
        <p>
          Надішліть клієнту це посилання. Оплату зарахує лише банк (підписане
          повідомлення monobank).
        </p>
        <input
          readOnly
          value={url}
          aria-label="Посилання на оплату"
          onFocus={(e) => e.currentTarget.select()}
        />
      </ActionDialog>
    );
  return (
    <ActionDialog
      {...common}
      title={t.actions.invoice}
      submitText="Отримати посилання"
      onSubmit={async ({ key }) => {
        const next = await act("/orders/" + o.id + "/invoice", {}, key);
        if (next.invoice?.url) {
          setUrl(next.invoice.url);
          return false;
        }
        return true;
      }}
    >
      <p>
        Сервер перевірить склад, ціну та строк оплати. Якщо відкритий рахунок
        уже є — повернеться той самий (без подвійної оплати).
      </p>
    </ActionDialog>
  );
}

function ShipmentDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const codes = Array.from(
    new Set(o.lines.filter((l) => l.supplier_code).map((l) => l.supplier_code)),
  );
  const [supplier, setSupplier] = useState(codes[0] ?? ""),
    [qty, setQty] = useState<Record<number, string>>({}),
    [dims, setDims] = useState({
      weight: "1",
      length: "30",
      width: "20",
      height: "10",
    });
  const [available, setAvailable] = useState(false),
    [extra, setExtra] = useState(false);
  const lines = o.lines.filter((l) => l.supplier_code === supplier);
  return (
    <ActionDialog
      {...common}
      wide
      title={t.actions.shipment}
      submitText="Створити чернетку посилки"
      onSubmit={({ key }) =>
        act(
          "/orders/" + o.id + "/shipments",
          {
            supplier_code: supplier,
            availability_confirmed: available,
            extra_delivery_agreed: extra,
            lines: lines
              .map((l) => ({
                line_no: l.line_no,
                qty: Number(
                  qty[l.line_no] ?? Math.max(0, l.qty - l.in_parcels),
                ),
              }))
              .filter((x) => x.qty > 0),
            package: {
              places: [
                {
                  weight: Number(dims.weight),
                  length: Number(dims.length),
                  width: Number(dims.width),
                  height: Number(dims.height),
                },
              ],
            },
          },
          key,
          "Посилку створено",
        )
      }
    >
      <label className="field">
        Постачальник (точка відправки — його профіль)
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
          {codes.map((c) => (
            <option key={c} value={c}>
              {o.lines.find((l) => l.supplier_code === c)?.supplier_name}
            </option>
          ))}
        </select>
      </label>
      {lines.map((l) => (
        <label className="field" key={l.line_no}>
          {l.name} · {l.sku} (залишилось {Math.max(0, l.qty - l.in_parcels)})
          <input
            type="number"
            min="0"
            step="1"
            max={l.qty - l.in_parcels}
            value={qty[l.line_no] ?? String(Math.max(0, l.qty - l.in_parcels))}
            onChange={(e) =>
              setQty((v) => ({ ...v, [l.line_no]: e.target.value }))
            }
          />
        </label>
      ))}
      <div className="grid-even">
        {(["weight", "length", "width", "height"] as const).map((k) => (
          <label className="field" key={k}>
            {
              {
                weight: "Вага, кг",
                length: "Довжина, см",
                width: "Ширина, см",
                height: "Висота, см",
              }[k]
            }
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              value={dims[k]}
              onChange={(e) => setDims((d) => ({ ...d, [k]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          required
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
        />{" "}
        Фактичну наявність і комплектацію перевірено
      </label>
      {codes.length > 1 && (
        <label className="check">
          <input
            type="checkbox"
            checked={extra}
            onChange={(e) => setExtra(e.target.checked)}
          />{" "}
          Окремі посилки погоджено з клієнтом
        </label>
      )}
      <p className="muted">
        Оголошена вартість — сума позицій. Доставку оплачує отримувач
        перевізнику.
      </p>
    </ActionDialog>
  );
}

function DeliveryDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const [city, setCity] = useState(""),
    [cityRef, setCityRef] = useState(""),
    [type, setType] = useState<"branch" | "postomat">("branch"),
    [point, setPoint] = useState("");
  const [recipient, setRecipient] = useState(
    String(o.contact.recipient ?? o.contact.name ?? ""),
  );
  const cities = useQuery({
    queryKey: ["np", "cities", city],
    queryFn: () =>
      fetch(
        "/shop/np-directory.php" + params({ kind: "cities", q: city }),
      ).then((r) => r.json()) as Promise<{
        items: { ref: string; name: string; note: string }[];
      }>,
    enabled: city.trim().length >= 2 && !cityRef,
  });
  const points = useQuery({
    queryKey: ["np", "points", cityRef, type],
    queryFn: () =>
      fetch(
        "/shop/np-directory.php" +
          params({ kind: "warehouses", city_ref: cityRef, type }),
      ).then((r) => r.json()) as Promise<{
        items: { ref: string; name: string }[];
      }>,
    enabled: !!cityRef,
  });
  return (
    <ActionDialog
      {...common}
      wide
      title={t.actions.delivery_edit}
      needReason
      onSubmit={({ key, reason }) =>
        act(
          "/orders/" + o.id + "/delivery",
          {
            delivery: { type, city_ref: cityRef, warehouse_ref: point },
            recipient: recipient.trim(),
            reason,
          },
          key,
          "Адресу доставки оновлено",
        )
      }
    >
      <p className="muted">
        Лише до створення ТТН і лише з довідника Нової пошти.
      </p>
      <label className="field">
        Місто
        <input
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setCityRef("");
            setPoint("");
          }}
          placeholder="Почніть вводити назву"
        />
      </label>
      {!cityRef &&
        cities.data?.items.map((c) => (
          <button
            type="button"
            key={c.ref}
            className="cmdk-item"
            onClick={() => {
              setCityRef(c.ref);
              setCity(c.name);
            }}
          >
            <span>
              {c.name}
              <small className="cell-sub">{c.note}</small>
            </span>
          </button>
        ))}
      {cityRef && (
        <>
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Тип доставки"
          >
            {(["branch", "postomat"] as const).map((k) => (
              <button
                type="button"
                role="radio"
                aria-checked={type === k}
                key={k}
                className={type === k ? "active" : ""}
                onClick={() => {
                  setType(k);
                  setPoint("");
                }}
              >
                {k === "branch" ? "Відділення" : "Поштомат"}
              </button>
            ))}
          </div>
          <label className="field">
            Відділення
            <select
              required
              value={point}
              onChange={(e) => setPoint(e.target.value)}
            >
              <option value="">Оберіть</option>
              {points.data?.items.map((w) => (
                <option key={w.ref} value={w.ref}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="field">
        Отримувач (ім’я та прізвище)
        <input
          required
          minLength={3}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </label>
    </ActionDialog>
  );
}

function ReturnDialog({ o, common }: { o: Card; common: Common }) {
  const client = useQueryClient();
  const { notify } = useWorkspace();
  const [qty, setQty] = useState<Record<number, string>>({});
  return (
    <ActionDialog
      {...common}
      wide
      title={t.actions.return}
      needReason
      submitText="Створити запит"
      onSubmit={async ({ key, reason }) => {
        await api(
          "/returns",
          {
            order_id: o.id,
            reason,
            expected_version: o.version,
            lines: Object.entries(qty)
              .filter(([, v]) => Number(v) > 0)
              .map(([n, v]) => ({ line_no: Number(n), qty: Number(v) })),
          },
          { idem: key },
        );
        void client.invalidateQueries({ queryKey: ["order", o.id] });
        notify("Запит повернення створено");
      }}
    >
      <p>
        Повернення товару і повернення коштів — окремі кроки. Кошти повертає
        власник після отримання товару.
      </p>
      {o.lines.map((l) => (
        <label className="field" key={l.line_no}>
          {l.name} · {l.sku} (до {l.qty})
          <input
            type="number"
            min="0"
            max={l.qty}
            step="1"
            value={qty[l.line_no] ?? ""}
            onChange={(e) =>
              setQty((v) => ({ ...v, [l.line_no]: e.target.value }))
            }
          />
        </label>
      ))}
    </ActionDialog>
  );
}

function AcceptInvoiceDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const [amount, setAmount] = useState(((o.total_minor ?? 0) / 100).toFixed(2)),
    [paid, setPaid] = useState(""),
    [doc, setDoc] = useState("");
  return (
    <ActionDialog
      {...common}
      title={t.actions.accept_invoice}
      needReason
      submitText="Прийняти оплату"
      onSubmit={({ key, reason }) =>
        act(
          "/orders/" + o.id + "/accept-invoice-payment",
          {
            amount_minor: Math.round(Number(amount) * 100),
            paid_on: paid,
            document: doc.trim(),
            reason,
          },
          key,
          "Оплату за рахунком прийнято",
        )
      }
    >
      <Note tone="info">
        Лише за випискою банку. Сума має дорівнювати сумі замовлення (
        {money(o.total_minor)}). Якщо резерв минув — сервер ще раз перевірить
        наявність.
      </Note>
      <label className="field">
        Сума за випискою, грн
        <input
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="field">
        Дата оплати
        <input
          type="date"
          required
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </label>
      <label className="field">
        Номер платіжки
        <input
          required
          maxLength={64}
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
        />
      </label>
    </ActionDialog>
  );
}

function LinkInvoiceDialog({
  o,
  act,
  common,
}: {
  o: Card;
  act: Act;
  common: Common;
}) {
  const [invoice, setInvoice] = useState("");
  return (
    <ActionDialog
      {...common}
      title={t.actions.reconcile_link}
      needReason
      onSubmit={({ key, reason }) =>
        act(
          "/orders/" + o.id + "/manual-reconcile",
          { invoice_id: invoice.trim(), reason },
          key,
        )
      }
    >
      <p>
        Вкажіть ID рахунку з кабінету monobank. Сервер перевірить reference,
        суму й валюту в банку.
      </p>
      <label className="field">
        ID рахунку
        <input
          required
          pattern="[A-Za-z0-9_-]{1,100}"
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
        />
      </label>
    </ActionDialog>
  );
}

function ResolveDialog({
  parcel,
  act,
  common,
}: {
  parcel: Parcel;
  act: Act;
  common: Common;
}) {
  const [choice, setChoice] = useState<"link" | "not_created">("link"),
    [number, setNumber] = useState("");
  return (
    <ActionDialog
      {...common}
      title="Розбір ТТН з невідомим результатом"
      needReason
      onSubmit={({ key, reason }) =>
        act(
          `/shipments/${parcel.id}/resolve`,
          { choice, reason, ...(choice === "link" ? { number } : {}) },
          key,
        )
      }
    >
      <div className="segmented" role="radiogroup" aria-label="Результат">
        <button
          type="button"
          role="radio"
          aria-checked={choice === "link"}
          className={choice === "link" ? "active" : ""}
          onClick={() => setChoice("link")}
        >
          ТТН існує
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={choice === "not_created"}
          className={choice === "not_created" ? "active" : ""}
          onClick={() => setChoice("not_created")}
        >
          ТТН не створено
        </button>
      </div>
      {choice === "link" ? (
        <label className="field">
          Номер ТТН (14 цифр)
          <input
            inputMode="numeric"
            pattern="[0-9]{14}"
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
      ) : (
        <Note>
          Скасування можливе лише після повної звірки з нульовим результатом
          понад 2 години тому; сервер перевірить ще раз.
        </Note>
      )}
    </ActionDialog>
  );
}

function Notes({ order }: { order: Card }) {
  const can = useCan();
  const client = useQueryClient();
  const [body, setBody] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID().replaceAll("-", "")),
    [error, setError] = useState<unknown>(null);
  const add = async () => {
    setError(null);
    try {
      await api("/orders/" + order.id + "/note", { body }, { idem: key });
      setBody("");
      setKey(crypto.randomUUID().replaceAll("-", ""));
      void client.invalidateQueries({ queryKey: ["order", order.id] });
    } catch (e) {
      setError(e);
      if (!(e instanceof ApiError) || e.status >= 500 || e.status === 0)
        setKey(crypto.randomUUID().replaceAll("-", ""));
    }
  };
  return (
    <Panel
      title="Коментарі"
      meta={<span className="muted">не бачить клієнт</span>}
    >
      <div className="panel-body stack">
        {order.notes.map((n) => (
          <div key={n.id}>
            <p>{n.body}</p>
            <small className="muted">
              {n.author ?? "Співробітник"} · {date(n.created_at, true)}
            </small>
          </div>
        ))}
        {!order.notes.length && <p className="muted">Коментарів ще немає.</p>}
        {can("note.create") && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label className="field">
              Новий коментар
              <textarea
                required
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            {error !== null && (
              <Note tone="bad">
                {error instanceof ApiError
                  ? error.message
                  : t.serviceUnavailable}
              </Note>
            )}
            <button className="btn">Додати коментар</button>
          </form>
        )}
      </div>
    </Panel>
  );
}

function Tasks({ order }: { order: Card }) {
  const can = useCan();
  const client = useQueryClient();
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [due, setDue] = useState("");
  return (
    <Panel
      title="Завдання"
      meta={
        can("task.manage") ? (
          <button className="btn small" onClick={() => setOpen(true)}>
            Додати
          </button>
        ) : undefined
      }
    >
      <div className="panel-body stack">
        {order.tasks.length ? (
          order.tasks.map((tk) => (
            <div key={tk.id} className="row">
              <Pill code={tk.state}>{t.taskState[tk.state]}</Pill>
              <span>{tk.title}</span>
              <span className="muted">
                {tk.due_at ? date(tk.due_at, true) : ""}
              </span>
            </div>
          ))
        ) : (
          <Empty title="Завдань немає" text="" />
        )}
      </div>
      {open && (
        <ActionDialog
          title="Нове завдання"
          onClose={() => setOpen(false)}
          submitText={t.save}
          onSubmit={async ({ key }) => {
            await api(
              "/tasks",
              {
                title: title.trim(),
                order_id: order.id,
                ...(due ? { due_at: due } : {}),
              },
              { idem: key },
            );
            void client.invalidateQueries({ queryKey: ["order", order.id] });
          }}
        >
          <label className="field">
            Що зробити
            <input
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Строк
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        </ActionDialog>
      )}
    </Panel>
  );
}
