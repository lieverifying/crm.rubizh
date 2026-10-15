import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import type {
  Order,
  PaymentDetail,
  PaymentList,
  ReturnDetail,
  ReturnList,
  ReviewList,
} from "./contract.gen";
import {
  api,
  date,
  download,
  money,
  params,
  useCan,
  useWorkspace,
} from "./lib";
import type { Column } from "./kit";
import {
  ActionDialog,
  DataView,
  Empty,
  ErrorBox,
  Kpi,
  Loading,
  Note,
  PageHead,
  Pager,
  Panel,
  Pill,
  SearchBox,
  Status3,
  Tabs,
  useDebounce,
} from "./kit";
import { label, t } from "./i18n";

type Pay = {
  id: number;
  order_id: number;
  order_number: string;
  invoice_id: string | null;
  amount: number;
  status?: string;
  refund_status?: string;
  created_at: string;
  method?: string;
  payment_due?: string;
};

export function Payments() {
  const can = useCan();
  const { notify } = useWorkspace();
  const [sp, setSp] = useSearchParams();
  const view = sp.get("view") ?? "all";
  const [text, setText] = useState("");
  const q = useDebounce(text);
  const query = { view, q, page: sp.get("page") ?? "1", limit: "25" };
  const list = useQuery({
    queryKey: ["payments", query],
    queryFn: () => api<PaymentList>("/payments" + params(query)),
    enabled: view !== "review",
    placeholderData: (p) => p,
  });
  const kpi = list.data?.kpi as Record<string, number> | undefined;
  const tabs: [string, string][] = [
    ["all", "Усі"],
    ["awaiting", "Очікують оплати"],
    ["paid", "Оплачені"],
    ["failed", "Неуспішні"],
    ["invoice_awaiting", "Очікують оплати за рахунком"],
    ["invoice_review", "Потребують звірки виписки"],
    ...(can("payment.review")
      ? [["review", "Потребують перевірки"] as [string, string]]
      : []),
  ];
  const columns: Column<Pay>[] = [
    {
      key: "order",
      title: "Замовлення",
      render: (p) => (
        <>
          <Link className="link" to={"/orders/" + p.order_id}>
            {p.order_number}
          </Link>
          <small>{date(p.created_at, true)}</small>
        </>
      ),
    },
    {
      key: "invoice",
      title: "Рахунок",
      render: (p) =>
        p.method === "invoice" ? (
          <span>
            Рахунок ФОП<small>оплатити до {date(p.payment_due, true)}</small>
          </span>
        ) : (
          <Link className="link" to={"/payments/" + p.id}>
            {p.invoice_id ?? "без ID банку"}
          </Link>
        ),
    },
    {
      key: "amount",
      title: "Сума",
      className: "right",
      render: (p) => <strong className="num">{money(p.amount)}</strong>,
    },
    {
      key: "status",
      title: "Статус",
      render: (p) =>
        p.method === "invoice" ? (
          <Pill code="AWAITING">очікує виписки</Pill>
        ) : (
          <Pill code={p.status}>{label(t.invoice, p.status)}</Pill>
        ),
    },
    {
      key: "refund",
      title: "Повернення",
      render: (p) =>
        p.refund_status ? (
          <Pill code={p.refund_status}>
            {label(t.invoice, p.refund_status)}
          </Pill>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];
  return (
    <>
      <PageHead
        title={t.nav.payments}
        text="«Оплачено» встановлює лише банк (підписане повідомлення monobank) або виписка для рахунку ФОП."
        actions={
          can("export.finance") ? (
            <button
              className="btn"
              onClick={() =>
                download("/payments/export" + params({ view })).catch((e) =>
                  notify(e.message, "error"),
                )
              }
            >
              <Download size={16} aria-hidden="true" /> Експорт
            </button>
          ) : undefined
        }
      />
      {kpi && (
        <div className="kpis">
          <Kpi title="Очікують оплати" value={kpi.awaiting ?? 0} />
          <Kpi title="Оплачено за 30 днів" value={kpi.paid_30d ?? 0} />
          <Kpi title="Неуспішних за 30 днів" value={kpi.failed_30d ?? 0} />
          {kpi.disputed !== undefined && (
            <Kpi
              title="Спірні події банку"
              value={kpi.disputed}
              hint="потребують перевірки"
            />
          )}
        </div>
      )}
      <Panel>
        <Tabs
          items={tabs}
          value={view}
          onChange={(v) => setSp(v === "all" ? {} : { view: v })}
        />
        {view === "review" ? (
          <ReviewQueue />
        ) : (
          <>
            <div className="toolbar">
              <SearchBox
                value={text}
                onChange={setText}
                placeholder="Номер замовлення або ID рахунку"
              />
            </div>
            {list.isPending ? (
              <Loading rows={5} />
            ) : list.isError ? (
              <ErrorBox
                error={list.error}
                onRetry={() => void list.refetch()}
              />
            ) : !list.data.rows.length ? (
              <Empty />
            ) : (
              <>
                <DataView
                  rows={list.data.rows as Pay[]}
                  columns={columns}
                  rowKey={(p) =>
                    p.method === "invoice" ? "o" + p.order_id : p.id
                  }
                  card={(p) => (
                    <Link
                      className="mcard"
                      to={
                        p.method === "invoice"
                          ? "/orders/" + p.order_id
                          : "/payments/" + p.id
                      }
                    >
                      <div className="mcard-top">
                        <strong>{p.order_number}</strong>
                        <strong className="num">{money(p.amount)}</strong>
                      </div>
                      <span>
                        {p.method === "invoice" ? (
                          <Pill code="AWAITING">рахунок ФОП</Pill>
                        ) : (
                          <Pill code={p.status}>
                            {label(t.invoice, p.status)}
                          </Pill>
                        )}
                      </span>
                    </Link>
                  )}
                />
                <Pager
                  page={list.data.pagination}
                  onChange={(n) =>
                    setSp({
                      ...(view !== "all" ? { view } : {}),
                      page: String(n),
                    })
                  }
                />
              </>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

/** CRM-4.1: parked signed MonoPay events; OWNER checks the bank now and closes them with a comment. No «credit payment» button exists. */
function ReviewQueue() {
  const client = useQueryClient();
  const { notify } = useWorkspace();
  const list = useQuery({
    queryKey: ["reviews"],
    queryFn: () => api<ReviewList>("/payments/review"),
  });
  const [resolve, setResolve] = useState<string | null>(null);
  if (list.isPending) return <Loading rows={3} />;
  if (list.isError)
    return <ErrorBox error={list.error} onRetry={() => void list.refetch()} />;
  if (!list.data.rows.length)
    return (
      <Empty
        title="Спірних подій немає"
        text="Усі підписані повідомлення банку відповідають рахункам."
      />
    );
  return (
    <div className="panel-body stack">
      {list.data.rows.map((r) => (
        <div className="parcel" key={r.id}>
          <div className="row">
            <Link className="link" to={"/orders/" + r.order_id}>
              {r.order_number}
            </Link>
            <Pill code={r.state === "OPEN" ? "NEEDS_REVIEW" : "CLOSED"}>
              {r.state === "OPEN" ? "відкрито" : "розглянуто"}
            </Pill>
            <span className="muted">{date(r.created_at, true)}</span>
          </div>
          <span>Подія банку: {r.detail}</span>
          <span className="sub">
            Результат звірки: {r.bank_result ?? "ще не перевірено"}
          </span>
          {r.state === "OPEN" && (
            <div className="row">
              <button
                className="btn small"
                onClick={async () => {
                  try {
                    await api(`/payments/review/${r.id}/check`, {});
                    notify("Банк перевірено");
                    void client.invalidateQueries({ queryKey: ["reviews"] });
                  } catch (e) {
                    notify((e as Error).message, "error");
                  }
                }}
              >
                Перевірити в банку зараз
              </button>
              <button className="btn small" onClick={() => setResolve(r.id)}>
                Позначити розглянутим
              </button>
            </div>
          )}
        </div>
      ))}
      {resolve && (
        <ActionDialog
          title="Позначити розглянутим"
          needReason
          onClose={() => setResolve(null)}
          onSubmit={async ({ key, reason }) => {
            await api(
              `/payments/review/${resolve}/resolve`,
              { reason },
              { idem: key },
            );
            void client.invalidateQueries({ queryKey: ["reviews"] });
          }}
        >
          <p>
            Опишіть, що перевірено (наприклад, «у кабінеті банку оплати немає»).
            Статус оплати не змінюється — його встановлює лише банк.
          </p>
        </ActionDialog>
      )}
    </div>
  );
}

export function PaymentCard() {
  const { id } = useParams();
  const can = useCan();
  const client = useQueryClient();
  const { notify } = useWorkspace();
  const q = useQuery({
    queryKey: ["payment", Number(id)],
    queryFn: () => api<PaymentDetail>("/payments/" + id),
  });
  const [refund, setRefund] = useState(false),
    [amount, setAmount] = useState("");
  if (q.isPending) return <Loading rows={6} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const rec = q.data.record as {
    id: number;
    invoice_id: string | null;
    reference: string;
    amount: number;
    status: string;
    refund_status: string;
    created_at: string;
  };
  const order = q.data.order as Order & {
    finance?: { refundable_minor: number } | null;
  };
  const refundable = order.finance?.refundable_minor ?? 0;
  return (
    <>
      <Link className="btn ghost small" to="/payments">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.payments}
      </Link>
      <PageHead
        title={"Рахунок " + (rec.invoice_id ?? rec.reference)}
        text={"Замовлення " + order.number}
        actions={
          can("payment.refund.execute") && refundable > 0 ? (
            <button className="btn" onClick={() => setRefund(true)}>
              Повернути кошти
            </button>
          ) : undefined
        }
      />
      <div className="grid-2">
        <div className="stack">
          <Panel title="Події банку (MonoPay)">
            <div className="timeline">
              {(q.data.events as { status: string; created_at: string }[]).map(
                (e, i) => (
                  <div className="timeline-item" key={i}>
                    <i aria-hidden="true" />
                    <div>
                      <strong>{label(t.invoice, e.status)}</strong>
                      <small className="cell-sub">
                        {date(e.created_at, true)} · підписане повідомлення
                      </small>
                    </div>
                  </div>
                ),
              )}
              {(
                (
                  q.data as {
                    bank_log?: {
                      action: string;
                      note: string;
                      created_at: string;
                    }[];
                  }
                ).bank_log ?? []
              ).map((e, i) => (
                <div className="timeline-item" key={"l" + i}>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{e.action}</strong>
                    <small className="cell-sub">
                      {date(e.created_at, true)} · {e.note}
                    </small>
                  </div>
                </div>
              ))}
              {!q.data.events.length && (
                <p className="muted">Подій ще немає.</p>
              )}
            </div>
          </Panel>
          <Panel title="Повернення коштів">
            <div className="panel-body stack">
              {(
                q.data.refunds as {
                  id: number;
                  amount: number;
                  status: string;
                  reason: string;
                  updated_at: string;
                }[]
              ).map((r) => (
                <div key={r.id} className="row">
                  <Pill code={r.status}>{label(t.invoice, r.status)}</Pill>
                  <strong className="num">{money(r.amount)}</strong>
                  <span className="muted">
                    {date(r.updated_at, true)} · {r.reason}
                  </span>
                </div>
              ))}
              {!q.data.refunds.length && (
                <p className="muted">Повернень не було.</p>
              )}
            </div>
          </Panel>
        </div>
        <Panel title="Замовлення">
          <div className="panel-body stack">
            <Link className="link" to={"/orders/" + order.id}>
              {order.number}
            </Link>
            <Status3 display={order.display} captions />
            <span>
              Сума рахунку: <strong className="num">{money(rec.amount)}</strong>
            </span>
            <span>
              Можна повернути:{" "}
              <strong className="num">{money(refundable)}</strong>
            </span>
          </div>
        </Panel>
      </div>
      {refund && (
        <ActionDialog
          title="Повернення коштів"
          needReason
          danger
          submitText="Повернути"
          onClose={() => setRefund(false)}
          onSubmit={async ({ key, reason }) => {
            await api(
              `/payments/${rec.id}/refund`,
              {
                amount: Math.round(Number(amount) * 100),
                reason,
                expected_version: order.version,
              },
              { idem: key },
            );
            notify("Повернення надіслано в банк");
            void client.invalidateQueries({ queryKey: ["payment", rec.id] });
          }}
          onStale={() => q.refetch()}
        >
          <Note tone="info">
            Повне або часткове — не більше {money(refundable)}. Подвійне
            натискання не створить друге повернення.
          </Note>
          <label className="field">
            Сума, грн
            <input
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </ActionDialog>
      )}
    </>
  );
}

type Ret = {
  id: number;
  order_id: number;
  order_number: string;
  state: string;
  created_at: string;
  refund_expected_minor: number | null;
};
export function Returns() {
  const [sp, setSp] = useSearchParams();
  const state = sp.get("state") ?? "";
  const query = { state, page: sp.get("page") ?? "1", limit: "25" };
  const list = useQuery({
    queryKey: ["returns", query],
    queryFn: () => api<ReturnList>("/returns" + params(query)),
  });
  const columns: Column<Ret>[] = [
    {
      key: "id",
      title: "Повернення",
      render: (r) => (
        <Link className="link" to={"/returns/" + r.id}>
          № {r.id}
        </Link>
      ),
    },
    {
      key: "order",
      title: "Замовлення",
      render: (r) => (
        <Link className="link" to={"/orders/" + r.order_id}>
          {r.order_number}
        </Link>
      ),
    },
    {
      key: "state",
      title: "Етап",
      render: (r) => (
        <Pill code={r.state}>{label(t.returnState, r.state)}</Pill>
      ),
    },
    {
      key: "money",
      title: "До повернення",
      className: "right",
      render: (r) => (
        <span className="num">{money(r.refund_expected_minor)}</span>
      ),
    },
    { key: "date", title: "Створено", render: (r) => date(r.created_at, true) },
  ];
  return (
    <>
      <PageHead
        title={t.nav.returns}
        text="Запит → розгляд → товар отримано → повернення коштів → завершено."
      />
      <Panel>
        <Tabs
          items={
            [["", "Усі"], ...Object.entries(t.returnState)] as [
              string,
              string,
            ][]
          }
          value={state}
          onChange={(v) => setSp(v ? { state: v } : {})}
        />
        {list.isPending ? (
          <Loading rows={4} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty title="Повернень немає" text="" />
        ) : (
          <>
            <DataView
              rows={list.data.rows as Ret[]}
              columns={columns}
              rowKey={(r) => r.id}
              card={(r) => (
                <Link className="mcard" to={"/returns/" + r.id}>
                  <div className="mcard-top">
                    <strong>
                      № {r.id} · {r.order_number}
                    </strong>
                    <Pill code={r.state}>{label(t.returnState, r.state)}</Pill>
                  </div>
                </Link>
              )}
            />
            <Pager
              page={list.data.pagination}
              onChange={(n) =>
                setSp({ ...(state ? { state } : {}), page: String(n) })
              }
            />
          </>
        )}
      </Panel>
    </>
  );
}

const NEXT: Record<string, [string, string][]> = {
  REQUESTED: [
    ["APPROVED", "Схвалити"],
    ["REJECTED", "Відхилити"],
  ],
  APPROVED: [
    ["IN_TRANSIT", "Товар у дорозі"],
    ["RECEIVED", "Товар отримано"],
  ],
  IN_TRANSIT: [["RECEIVED", "Товар отримано"]],
  RECEIVED: [
    ["REFUND_PENDING", "До повернення коштів"],
    ["CLOSED", "Завершити"],
  ],
  REFUND_PENDING: [["CLOSED", "Завершити з підтвердженням повернення"]],
};
export function ReturnCard() {
  const { id } = useParams();
  const can = useCan();
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["return", Number(id)],
    queryFn: () => api<ReturnDetail>("/returns/" + id),
  });
  const [to, setTo] = useState<string | null>(null),
    [decision, setDecision] = useState("KEEP_COMMITTED"),
    [ttn, setTtn] = useState(""),
    [alloc, setAlloc] = useState<Record<number, string>>({});
  if (q.isPending) return <Loading rows={5} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const r = q.data.record as {
    id: number;
    order_id: number;
    state: string;
    version: number;
    reason: string;
    lines_json: string;
    refund_expected_minor: number | null;
    tracking_number: string;
    inventory_decision: string;
  };
  const order = q.data.order as Order & {
    finance?: {
      refunds: { id: number; amount_minor: number; status: string }[];
    } | null;
  };
  const lines = JSON.parse(r.lines_json || "[]") as {
    line_no: number;
    qty: number;
    refund_minor?: number;
  }[];
  const allowed = (s: string) =>
    ["IN_TRANSIT", "RECEIVED"].includes(s)
      ? can("return.receive")
      : can("return.review");
  return (
    <>
      <Link className="btn ghost small" to="/returns">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.returns}
      </Link>
      <PageHead
        title={"Повернення № " + r.id}
        text={"Замовлення " + order.number + " · " + r.reason}
        actions={(NEXT[r.state] ?? [])
          .filter(([s]) => allowed(s))
          .map(([s, name]) => (
            <button key={s} className="btn" onClick={() => setTo(s)}>
              {name}
            </button>
          ))}
      />
      <div className="grid-2">
        <Panel title="Позиції">
          <div className="panel-body stack">
            {lines.map((l) => {
              const item = order.items[l.line_no] as
                | { name?: string; sku?: string }
                | undefined;
              return (
                <div key={l.line_no} className="row">
                  <strong>{item?.name}</strong>
                  <span className="muted">
                    {item?.sku} × {l.qty}
                  </span>
                  {l.refund_minor !== undefined && order.finance !== null && (
                    <span className="num">{money(l.refund_minor)}</span>
                  )}
                </div>
              );
            })}
            <Pill code={r.state}>{label(t.returnState, r.state)}</Pill>
          </div>
        </Panel>
        <Panel title="Замовлення">
          <div className="panel-body">
            <Link className="link" to={"/orders/" + order.id}>
              {order.number}
            </Link>
            <Status3 display={order.display} captions />
          </div>
        </Panel>
      </div>
      {to && (
        <ActionDialog
          title={label(t.returnState, to)}
          needReason
          onClose={() => setTo(null)}
          onStale={() => q.refetch()}
          onSubmit={async ({ key, reason }) => {
            await api(
              `/returns/${r.id}/transition`,
              {
                state: to,
                reason,
                return_version: r.version,
                ...(to === "IN_TRANSIT" && ttn ? { tracking_number: ttn } : {}),
                ...(to === "CLOSED" ? { inventory_decision: decision } : {}),
                ...(to === "CLOSED" && r.state === "REFUND_PENDING"
                  ? {
                      refund_allocations: Object.entries(alloc)
                        .filter(([, v]) => Number(v) > 0)
                        .map(([rid, v]) => ({
                          refund_id: Number(rid),
                          amount: Math.round(Number(v) * 100),
                        })),
                    }
                  : {}),
              },
              { idem: key },
            );
            void client.invalidateQueries({ queryKey: ["return", r.id] });
          }}
        >
          {to === "IN_TRANSIT" && (
            <label className="field">
              ТТН зворотної посилки (необов’язково)
              <input
                inputMode="numeric"
                pattern="[0-9]{14}"
                value={ttn}
                onChange={(e) => setTtn(e.target.value)}
              />
            </label>
          )}
          {to === "CLOSED" && can("inventory.return") && (
            <label className="field">
              Рішення щодо залишку
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="KEEP_COMMITTED">
                  Зберегти складське зобов’язання
                </option>
                <option value="PIM_RECONCILIATION_REQUIRED">
                  Звірити залишок у PIM
                </option>
              </select>
            </label>
          )}
          {to === "CLOSED" && r.state === "REFUND_PENDING" && (
            <>
              <Note tone="info">
                Вкажіть, які успішні повернення коштів належать цьому поверненню
                товару (разом {money(r.refund_expected_minor)}).
              </Note>
              {(order.finance?.refunds ?? [])
                .filter((x) => x.status === "success")
                .map((x) => (
                  <label className="field" key={x.id}>
                    Повернення № {x.id} ({money(x.amount_minor)}), грн
                    <input
                      inputMode="decimal"
                      value={alloc[x.id] ?? ""}
                      onChange={(e) =>
                        setAlloc((v) => ({ ...v, [x.id]: e.target.value }))
                      }
                    />
                  </label>
                ))}
            </>
          )}
        </ActionDialog>
      )}
    </>
  );
}
