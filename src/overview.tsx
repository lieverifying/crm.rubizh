import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ShoppingBag,
  Clock,
  Truck,
  AlertTriangle,
  CreditCard,
  CalendarDays,
} from "lucide-react";
import { api, params } from "./api";
import type { Dashboard, Report, Settings } from "./api";
import {
  PageHead,
  Section,
  Loading,
  ErrorBox,
  Empty,
  money,
  date,
  Badge,
} from "./ui";
import { useCan } from "./context";
function Stat({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{title}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Overview() {
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) =>
      api<Dashboard>("/dashboard", undefined, "GET", signal),
  });
  return (
    <>
      <PageHead
        eyebrow="ОПЕРАЦІЇ / СЬОГОДНІ"
        title="Огляд робочого дня"
        description={new Intl.DateTimeFormat("uk-UA", {
          dateStyle: "full",
          timeZone: "Europe/Kyiv",
        }).format(new Date())}
        action={
          <Link className="btn primary" to="/orders">
            До замовлень <ArrowUpRight size={16} />
          </Link>
        }
      />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              title="Нові замовлення"
              value={q.data.today.metrics.orders_created || 0}
              detail="Створені сьогодні"
              icon={ShoppingBag}
            />
            <Stat
              title="Потребують підтвердження"
              value={q.data.counts.confirmation || 0}
              detail="Перевірити наявність і склад"
              icon={Clock}
            />
            <Stat
              title="До відправлення"
              value={q.data.counts.paid_to_ship || 0}
              detail="Оплачені замовлення"
              icon={Truck}
            />
            <Stat
              title={
                q.data.today.financial ? "Оплачено сьогодні" : "Очікують оплати"
              }
              value={
                q.data.today.financial
                  ? money(q.data.today.financial.paid_revenue)
                  : q.data.counts.waiting_payment || 0
              }
              detail={
                q.data.today.financial
                  ? "Підтверджені платежі"
                  : "Підтверджені замовлення"
              }
              icon={CreditCard}
            />
          </div>
          <div className="overview-grid">
            <Section
              title="Черга підтвердження"
              meta={
                <Link to="/orders?view=confirmation" className="text-link">
                  Усі замовлення <ArrowUpRight size={14} />
                </Link>
              }
            >
              {q.data.requires_action.length ? (
                <div className="action-list">
                  {q.data.requires_action.map((o) => (
                    <Link key={o.id} to={"/orders/" + o.id}>
                      <div className="list-avatar">
                        <ShoppingBag size={19} />
                      </div>
                      <div>
                        <strong>{o.number}</strong>
                        <small>
                          {o.customer.name} · {date(o.created_at)}
                        </small>
                      </div>
                      <Badge value={o.order_status} />
                      <span className="amount">{money(o.total)}</span>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Черга опрацьована"
                  description="Нові замовлення з підтвердженням з’являться тут."
                />
              )}
            </Section>
            <Section
              title="Потребують уваги"
              meta={<AlertTriangle size={17} className="accent" />}
            >
              {q.data.problems.length ? (
                <div className="problem-list">
                  {q.data.problems.map((o) => (
                    <Link key={o.id} to={"/orders/" + o.id}>
                      <strong>{o.number}</strong>
                      <Badge value={o.blockers[0] ?? o.order_status} />
                      <small>{o.customer.name}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Критичних задач немає"
                  description="Проблеми оплат, відправлень і старих замовлень з’являться тут."
                />
              )}
            </Section>
          </div>
          <Section
            title="Стан операцій"
            meta={<span className="muted">Усі замовлення</span>}
          >
            <div className="operation-grid">
              {[
                ["payment", "Очікують оплати", q.data.counts.waiting_payment],
                ["shipping", "До відправлення", q.data.counts.paid_to_ship],
                ["transit", "У дорозі", q.data.counts.transit],
                ["problems", "Проблемні", q.data.counts.problems],
              ].map(([view, title, value]) => (
                <Link key={view} to={"/orders?view=" + view}>
                  <span>{title}</span>
                  <strong>{value || 0}</strong>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          </Section>
        </>
      )}
    </>
  );
}
export function Reports() {
  const [period, setPeriod] = useState("7d"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [manager, setManager] = useState(""),
    [supplier, setSupplier] = useState("");
  const can = useCan("financial.audit.view");
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/settings"),
  });
  const q = useQuery({
    queryKey: ["reports", period, from, to, manager, supplier],
    queryFn: ({ signal }) =>
      api<Report>(
        "/reports" + params({ period, from, to, manager, supplier }),
        undefined,
        "GET",
        signal,
      ),
    enabled: period !== "custom" || (!!from && !!to),
  });
  return (
    <>
      <PageHead
        eyebrow="АНАЛІТИКА"
        title="Звіти"
        description="Оплати та повернення відображаються за датою підтвердження операції."
      />
      <div className="filters panel">
        <CalendarDays size={17} />
        <select
          aria-label="Період звіту"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="today">Сьогодні</option>
          <option value="yesterday">Учора</option>
          <option value="7d">7 днів</option>
          <option value="30d">30 днів</option>
          <option value="custom">Свій період</option>
        </select>
        {period === "custom" && (
          <>
            <input
              aria-label="З дати"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              aria-label="До дати"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
        <select
          aria-label="Менеджер звіту"
          value={manager}
          onChange={(e) => setManager(e.target.value)}
        >
          <option value="">Усі менеджери</option>
          {settings.data?.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Постачальник звіту"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        >
          <option value="">Усі постачальники</option>
          {settings.data?.sender_profiles.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              title="Створено замовлень"
              value={q.data.metrics.orders_created || 0}
              detail="У вибраному періоді"
              icon={ShoppingBag}
            />
            <Stat
              title="Доставлено"
              value={q.data.metrics.delivered || 0}
              detail="Замовлення цього періоду"
              icon={Truck}
            />
            <Stat
              title="Повернення"
              value={q.data.metrics.returns || 0}
              detail="Фізичні заявки"
              icon={AlertTriangle}
            />
            <Stat
              title="Черга підтвердження"
              value={q.data.metrics.confirmation_queue || 0}
              detail="Замовлення цього періоду"
              icon={Clock}
            />
          </div>
          {can && q.data.financial && (
            <>
              <div className="stats-grid">
                <Stat
                  title="Оплачений оборот"
                  value={money(q.data.financial.paid_revenue)}
                  detail="Підтверджені платежі"
                  icon={CreditCard}
                />
                <Stat
                  title="Повернено коштів"
                  value={money(q.data.financial.refunds)}
                  detail="Успішні повернення"
                  icon={CreditCard}
                />
                <Stat
                  title="Чистий оборот"
                  value={money(q.data.financial.net_revenue)}
                  detail="Оплати мінус повернення"
                  icon={CreditCard}
                />
                <Stat
                  title="Середній чек"
                  value={money(q.data.financial.average_paid_order)}
                  detail={q.data.financial.paid_orders + " оплачених замовлень"}
                  icon={ShoppingBag}
                />
              </div>
              <Section title="Оплати за днями">
                {q.data.financial.daily.length ? (
                  <div className="chart">
                    {q.data.financial.daily.map((d) => (
                      <div key={d.date}>
                        <span>{date(d.date)}</span>
                        <div className="chart-track">
                          <i
                            style={{
                              width:
                                Math.max(
                                  2,
                                  (d.amount /
                                    Math.max(
                                      ...q.data.financial!.daily.map(
                                        (v) => v.amount,
                                      ),
                                    )) *
                                    100,
                                ) + "%",
                            }}
                          />
                        </div>
                        <strong>{money(d.amount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Підтверджених оплат немає"
                    description="Неоплачені замовлення не включаються в оборот."
                  />
                )}
              </Section>
            </>
          )}
        </>
      )}
    </>
  );
}
