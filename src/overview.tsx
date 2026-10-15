import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type {
  Analytics as AnalyticsT,
  Dashboard,
  OrderSummary,
} from "./contract.gen";
import { api, date, money, params, shortDate, useCan } from "./lib";
import {
  Bars,
  Empty,
  ErrorBox,
  Kpi,
  LineChart,
  Loading,
  PageHead,
  Panel,
  PeriodSelect,
  Status3,
} from "./kit";
import { t } from "./i18n";

type Money = {
  value_minor: number | null;
  previous_minor: number | null;
  available?: boolean;
  note?: string | null;
};
function usePeriod(initial = "30d") {
  const [period, setPeriod] = useState(initial),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const query = { period, ...(period === "custom" ? { from, to } : {}) };
  const ready = period !== "custom" || (!!from && !!to);
  return {
    period,
    setPeriod,
    from,
    to,
    setRange: (f: string, x: string) => {
      setFrom(f);
      setTo(x);
    },
    query,
    ready,
  };
}

export function Overview() {
  const can = useCan();
  const p = usePeriod("30d");
  const d = useQuery({
    queryKey: ["dashboard", p.query],
    queryFn: ({ signal }) =>
      api<Dashboard>("/dashboard" + params(p.query), undefined, { signal }),
    enabled: p.ready,
    refetchInterval: 60_000,
  });
  const kpi = d.data?.kpi as
    | Record<string, Money & { value?: number; previous?: number }>
    | undefined;
  const statuses = d.data?.statuses as Record<string, number> | undefined;
  const statusNames: Record<string, string> = {
    waiting: "Очікує підтвердження",
    confirmed: "Підтверджене",
    packing: "У комплектації",
    delivery: "Передане на доставку",
    completed: "Завершене",
    cancelled: "Скасоване",
  };
  return (
    <>
      <PageHead
        eyebrow="Ваш магазин під контролем"
        title="Огляд"
        text="Ключові показники за обраний період (час — Київ)."
        actions={
          <PeriodSelect
            value={p.period}
            onChange={p.setPeriod}
            from={p.from}
            to={p.to}
            onRange={p.setRange}
          />
        }
      />
      {d.isPending ? (
        <Loading rows={6} />
      ) : d.isError ? (
        <ErrorBox error={d.error} onRetry={() => void d.refetch()} />
      ) : (
        <div className="stack">
          <div className="kpis">
            {kpi?.revenue && (
              <Kpi
                title="Виручка"
                value={money(kpi.revenue.value_minor)}
                now={kpi.revenue.value_minor}
                prev={kpi.revenue.previous_minor}
                hint="оплачено за період"
              />
            )}
            <Kpi
              title="Замовлення"
              value={kpi?.orders.value ?? 0}
              now={kpi?.orders.value}
              prev={kpi?.orders.previous}
              hint="створено за період"
            />
            {kpi?.average && (
              <Kpi
                title="Середній чек"
                value={money(kpi.average.value_minor)}
                now={kpi.average.value_minor}
                prev={kpi.average.previous_minor}
              />
            )}
            <Kpi
              title="Очікують обробки"
              value={kpi?.awaiting_processing.value ?? 0}
              hint="підтвердження та відправка"
            />
            {can("dashboard.finance") && kpi?.gross_profit && (
              <Kpi
                title="Валовий прибуток"
                value={
                  kpi.gross_profit.available
                    ? money(kpi.gross_profit.value_minor)
                    : "—"
                }
                now={kpi.gross_profit.value_minor}
                prev={kpi.gross_profit.previous_minor}
                hint={
                  kpi.gross_profit.available
                    ? "до операційних витрат"
                    : (kpi.gross_profit.note ?? "")
                }
              />
            )}
          </div>
          <div className="grid-2">
            <Panel
              title="Динаміка"
              meta={
                <span className="muted">
                  {date(
                    String(
                      (d.data.period as { label_from?: string }).label_from,
                    ),
                  )}{" "}
                  —{" "}
                  {date(
                    String((d.data.period as { label_to?: string }).label_to),
                  )}
                </span>
              }
            >
              <div className="panel-body">
                <LineChart
                  label={
                    can("order.finance.view")
                      ? "Виручка за днями порівняно з попереднім періодом"
                      : "Замовлення за днями"
                  }
                  points={(d.data.chart ?? []).map((c) => {
                    const r = c as {
                      date: string;
                      orders: number;
                      revenue_minor?: number;
                      previous_revenue_minor?: number;
                    };
                    return {
                      x: shortDate(r.date),
                      y:
                        r.revenue_minor !== undefined
                          ? r.revenue_minor / 100
                          : r.orders,
                      prev:
                        r.previous_revenue_minor !== undefined
                          ? r.previous_revenue_minor / 100
                          : undefined,
                    };
                  })}
                />
                <p className="muted">
                  {can("order.finance.view")
                    ? "Суцільна лінія — поточний період, пунктир — попередній."
                    : "Кількість створених замовлень."}
                </p>
              </div>
            </Panel>
            <Panel title="Замовлення за статусами">
              <div className="panel-body">
                <Bars
                  items={Object.entries(statusNames).map(([k, name]) => ({
                    label: name,
                    value: statuses?.[k] ?? 0,
                    text: String(statuses?.[k] ?? 0),
                  }))}
                />
              </div>
            </Panel>
          </div>
          <div className="grid-2">
            <Panel
              title="Останні замовлення"
              meta={
                <Link className="link" to="/orders">
                  Усі замовлення
                </Link>
              }
            >
              <OrderMiniList rows={d.data.recent as OrderSummary[]} />
            </Panel>
            <Panel title="Потребує уваги">
              {(d.data.attention as OrderSummary[]).length ? (
                <OrderMiniList
                  rows={d.data.attention as OrderSummary[]}
                  attention
                />
              ) : (
                <Empty
                  title="Усе під контролем"
                  text="Немає замовлень, що чекають рішення."
                />
              )}
            </Panel>
          </div>
          <div className="grid-even">
            <Panel title="Популярні товари">
              <div className="panel-body">
                {(d.data.popular ?? []).length ? (
                  <Bars
                    items={(
                      d.data.popular as {
                        name: string | null;
                        sku: string;
                        qty: number;
                      }[]
                    ).map((r) => ({
                      label: r.name ?? r.sku,
                      value: r.qty,
                      text: r.qty + " шт.",
                    }))}
                  />
                ) : (
                  <Empty title="Продажів за період немає" text="" />
                )}
              </div>
            </Panel>
            {can("dashboard.managers") && d.data.managers ? (
              <Panel
                title="Робота менеджерів"
                meta={<span className="muted">лише для власника</span>}
              >
                <div className="panel-body">
                  <Bars
                    items={(
                      d.data.managers as {
                        name: string;
                        assigned: number;
                        confirmed: number;
                        completed: number;
                      }[]
                    ).map((m) => ({
                      label: m.name,
                      value: m.assigned,
                      text: `${m.assigned} призначено · ${m.confirmed} підтверджено · ${m.completed} завершено`,
                    }))}
                  />
                </div>
              </Panel>
            ) : (
              <Panel title="Остання активність">
                <ActivityList rows={(d.data.activity ?? []) as ActivityRow[]} />
              </Panel>
            )}
          </div>
          {can("dashboard.managers") && (
            <Panel title="Остання активність">
              <ActivityList rows={(d.data.activity ?? []) as ActivityRow[]} />
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function OrderMiniList({
  rows,
  attention = false,
}: {
  rows: OrderSummary[];
  attention?: boolean;
}) {
  if (!rows.length) return <Empty title="Замовлень ще немає" text="" />;
  return (
    <div>
      {rows.map((o) => (
        <Link key={o.id} to={"/orders/" + o.id} className="mcard">
          <div className="mcard-top">
            <strong>{o.number}</strong>
            <span className="num">{money(o.total_minor)}</span>
          </div>
          <div className="sub">
            {String(o.customer.name || "—")} · {date(o.created_at, true)}
            {attention && o.attention.length
              ? " · " + o.attention.map((a) => t.attention[a] ?? a).join(", ")
              : ""}
          </div>
          <Status3 display={o.display} />
        </Link>
      ))}
    </div>
  );
}
type ActivityRow = {
  id: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
  reason: string;
};
export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  if (!rows.length) return <Empty title="Подій ще немає" text="" />;
  return (
    <div className="timeline">
      {rows.map((r) => (
        <div className="timeline-item" key={r.id}>
          <i aria-hidden="true" />
          <div>
            <strong>{actionText(r.action)}</strong>
            {r.entity === "order" && (
              <>
                {" "}
                ·{" "}
                <Link className="link" to={"/orders/" + r.entity_id}>
                  замовлення
                </Link>
              </>
            )}
            <small className="cell-sub">
              {date(r.created_at, true)} · {r.actor ?? "Система"}
              {r.reason ? " · " + r.reason : ""}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
const actionNames: Record<string, string> = {
  "order.assign": "Призначено менеджера",
  "order.confirm": "Замовлення підтверджено",
  "order.cancel": "Замовлення скасовано",
  "order.invoice": "Створено посилання на оплату",
  "order.packing": "Передано в комплектацію",
  "order.complete": "Замовлення завершено",
  "order.line_stock": "Перевірено залишок",
  "order.line_replace": "Позицію замінено",
  "order.line_remove": "Позицію прибрано",
  "order.line_supplier": "Призначено постачальника рядку",
  "order.delivery_update": "Виправлено адресу доставки",
  "order.problem": "Змінено позначку проблеми",
  "order.create_phone": "Створено замовлення з телефону",
  "note.append": "Додано коментар",
  "payment.refund.request": "Запит повернення коштів",
  "payment.refund.result": "Результат повернення коштів",
  "payment.invoice.accept": "Прийнято оплату за рахунком",
  "payment.manual_reconcile": "Ручна звірка оплати",
  "payment.reconcile_not_created": "Рахунок у банку не створено",
  "shipment.draft": "Створено посилку",
  "shipment.create": "Створено ТТН",
  "shipment.refresh": "Оновлено статус НП",
  "shipment.manual_deliver": "Доставку підтверджено вручну",
  "shipment.resolve_unknown": "Розібрано ТТН",
  "shipment.delete_ttn": "ТТН видалено",
  "return.request": "Запит повернення",
  "return.transition": "Змінено статус повернення",
  "customer.phone_view": "Переглянуто телефон клієнта",
  "login.success": "Вхід",
  logout: "Вихід",
  "staff.update": "Змінено співробітника",
  "staff.invite": "Запрошено співробітника",
  "export.orders": "Експорт замовлень",
};
export const actionText = (a: string) => actionNames[a] ?? a;

export function Analytics() {
  const p = usePeriod("30d");
  const a = useQuery({
    queryKey: ["analytics", p.query],
    queryFn: ({ signal }) =>
      api<AnalyticsT>("/analytics" + params(p.query), undefined, { signal }),
    enabled: p.ready,
  });
  const totals = a.data?.totals as Record<string, number> | undefined;
  const gp = a.data?.gross_profit as
    | {
        value_minor: number | null;
        available: boolean;
        note?: string;
        missing_skus?: number;
      }
    | undefined;
  const slices = a.data?.slices as
    | Record<
        string,
        { name: string; orders?: number; qty?: number; revenue_minor: number }[]
      >
    | undefined;
  return (
    <>
      <PageHead
        title={t.nav.analytics}
        text="Гроші — за підтвердженими банком оплатами та виписками; формули — docs/crm/05."
        actions={
          <PeriodSelect
            value={p.period}
            onChange={p.setPeriod}
            from={p.from}
            to={p.to}
            onRange={p.setRange}
          />
        }
      />
      {a.isPending ? (
        <Loading rows={6} />
      ) : a.isError ? (
        <ErrorBox error={a.error} onRetry={() => void a.refetch()} />
      ) : (
        <div className="stack">
          <div className="kpis">
            <Kpi
              title="Виручка"
              value={money(totals?.revenue_minor)}
              now={totals?.revenue_minor}
              prev={totals?.previous_revenue_minor}
            />
            <Kpi
              title="Оплачених замовлень"
              value={totals?.paid_orders ?? 0}
              hint={`створено ${totals?.orders_created ?? 0}`}
            />
            <Kpi title="Середній чек" value={money(totals?.average_minor)} />
            <Kpi
              title="Повернення"
              value={money(totals?.refunds_minor)}
              hint={"чиста виручка " + money(totals?.net_minor)}
            />
            <Kpi
              title="Валовий прибуток"
              value={gp?.available ? money(gp.value_minor) : "—"}
              hint={
                gp?.available
                  ? "собівартість — виплата постачальнику (PIM)"
                  : (gp?.note ?? "") +
                    (gp?.missing_skus
                      ? ` · SKU без даних: ${gp.missing_skus}`
                      : "")
              }
            />
            <Kpi
              title="Покупці"
              value={`${totals?.new_buyers ?? 0} нових / ${totals?.repeat_buyers ?? 0} повторних`}
            />
          </div>
          <Panel title="Виручка за днями">
            <div className="panel-body">
              <LineChart
                label="Виручка за днями"
                points={(
                  a.data.daily as { date: string; revenue_minor: number }[]
                ).map((r) => ({
                  x: shortDate(r.date),
                  y: r.revenue_minor / 100,
                }))}
              />
            </div>
          </Panel>
          <div className="grid-even">
            {(["managers", "suppliers", "categories", "channels"] as const).map(
              (k) => (
                <Panel
                  key={k}
                  title={
                    {
                      managers: "За менеджерами",
                      suppliers: "За постачальниками",
                      categories: "За категоріями",
                      channels: "За каналами",
                    }[k]
                  }
                >
                  <div className="panel-body">
                    {(slices?.[k] ?? []).length ? (
                      <Bars
                        items={slices![k].map((r) => ({
                          label:
                            k === "channels"
                              ? (t.channel[r.name] ?? r.name)
                              : r.name,
                          value: r.revenue_minor,
                          text: money(r.revenue_minor),
                        }))}
                      />
                    ) : (
                      <Empty title="Немає даних" text="" />
                    )}
                  </div>
                </Panel>
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}
