import { useState, useContext } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ArrowUpRight,
  Check,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api, params, requestId } from "./api";
import type {
  Customer,
  Order,
  List,
  Payment,
  Shipment,
  Return,
  Audit,
  Settings,
  Sender,
  Staff,
  Refund,
  Note,
} from "./api";
import { Workspace, useCan } from "./context";
import {
  PageHead,
  Section,
  Badge,
  Empty,
  Loading,
  ErrorBox,
  Pager,
  Dialog,
  money,
  date,
  label,
  useDebounce,
} from "./ui";
import { OrderTable, Notes } from "./orders";
function useList<T>(entity: string) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [state, setState] = useState("");
  const q = useDebounce(search);
  const query = useQuery({
    queryKey: [entity, q, page, state],
    queryFn: ({ signal }) =>
      api<List<T>>(
        "/" + entity + params({ q, page, state }),
        undefined,
        "GET",
        signal,
      ),
  });
  return {
    search,
    setSearch: (v: string) => {
      setPage(1);
      setSearch(v);
    },
    page,
    setPage,
    state,
    setState: (v: string) => {
      setPage(1);
      setState(v);
    },
    query,
  };
}
function ListToolbar({
  search,
  onSearch,
  state,
  onState,
  states = [],
}: {
  search: string;
  onSearch: (v: string) => void;
  state?: string;
  onState?: (v: string) => void;
  states?: string[];
}) {
  return (
    <div className="table-toolbar">
      <div className="search-field">
        <Search size={16} />
        <input
          aria-label="Пошук у списку"
          placeholder="Пошук за номером або контактом…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {onState && (
        <select
          aria-label="Фільтр стану"
          value={state}
          onChange={(e) => onState(e.target.value)}
        >
          <option value="">Усі стани</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
export function Customers() {
  const l = useList<Customer>("customers");
  return (
    <>
      <PageHead
        eyebrow="КОНТАКТИ"
        title="Клієнти"
        description="Підтверджені профілі й контакти замовлень із доказами ідентичності."
      />
      <div className="panel">
        <ListToolbar search={l.search} onSearch={l.setSearch} />
        {l.query.isPending ? (
          <Loading />
        ) : l.query.isError ? (
          <ErrorBox error={l.query.error} />
        ) : (
          <>
            {l.query.data.rows.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Клієнт</th>
                      <th>Контакт</th>
                      <th>Ідентичність</th>
                      <th>Замовлення</th>
                      <th>Оплачено</th>
                      <th>Останнє замовлення</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {l.query.data.rows.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            className="strong"
                            to={"/customers/" + encodeURIComponent(c.id)}
                          >
                            {c.name || c.email || "Контакт замовлення"}
                          </Link>
                          <small>{c.email}</small>
                        </td>
                        <td>
                          {c.phone || "—"}
                          <small>
                            {c.phone_raw && c.phone_raw !== c.phone
                              ? c.phone_raw
                              : ""}
                          </small>
                        </td>
                        <td>
                          <Badge
                            value={
                              c.phone_verified ? "VERIFIED" : "ORDER_CONTACT"
                            }
                          />
                        </td>
                        <td>
                          {c.orders || 0}
                          <small>{c.active_orders || 0} активних</small>
                        </td>
                        <td className="amount">{money(c.paid_total || 0)}</td>
                        <td>{date(c.last_order ?? "")}</td>
                        <td>
                          <Link
                            to={"/customers/" + encodeURIComponent(c.id)}
                            aria-label={"Клієнт " + c.name}
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Клієнтів не знайдено"
                description="Спробуйте інше ім’я, email або телефон."
              />
            )}
            <Pager page={l.query.data.pagination} onChange={l.setPage} />
          </>
        )}
      </div>
    </>
  );
}
export function CustomerPage() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["customer", id, page],
    queryFn: () =>
      api<{
        customer: Customer;
        orders: Order[];
        notes: Note[];
        identities: { provider: string; subject: string }[];
        stats: Record<string, number>;
        pagination: import("./api").Page;
      }>("/customers/" + encodeURIComponent(id!) + params({ page })),
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const c = q.data.customer;
  return (
    <>
      <Link className="back-link" to="/customers">
        ← Клієнти
      </Link>
      <PageHead
        eyebrow="ПРОФІЛЬ КЛІЄНТА"
        title={c.name || c.email || "Контакт замовлення"}
      />
      <div className="detail-grid">
        <div>
          <Section title="Історія замовлень">
            {q.data.orders.length ? (
              <>
                <OrderTable rows={q.data.orders} />
                <Pager page={q.data.pagination} onChange={setPage} />
              </>
            ) : (
              <Empty
                title="Замовлень немає"
                description="Показуються тільки замовлення з підтвердженим зв’язком із профілем."
              />
            )}
          </Section>
          <Notes entity="customers" id={id!} notes={q.data.notes} />
        </div>
        <Section title="Контакт та ідентичність">
          <dl className="detail-data">
            <dt>Email</dt>
            <dd>{c.email || "—"}</dd>
            <dt>Телефон</dt>
            <dd>{c.phone || "—"}</dd>
            <dt>Оригінальний контакт</dt>
            <dd>{c.phone_raw || "—"}</dd>
            <dt>Доказ ідентичності</dt>
            <dd>
              <Badge value={c.phone_verified ? "VERIFIED" : "ORDER_CONTACT"} />
            </dd>
            <dt>Джерело</dt>
            <dd>{label(c.source)}</dd>
          </dl>
          <p className="panel-pad muted">
            Збіг номера телефону сам по собі не дає доступу до історії замовлень
            іншого профілю.
          </p>
        </Section>
      </div>
    </>
  );
}
export function Payments() {
  return (
    <EntityList
      entity="payments"
      title="Платежі"
      description="Рахунки MonoPay, підтверджені оплати й повернення коштів."
      states={[
        "created",
        "processing",
        "success",
        "failure",
        "expired",
        "unknown",
        "reversed",
      ]}
    />
  );
}
export function Shipments() {
  return (
    <EntityList
      entity="shipments"
      title="Відправлення"
      description="Чернетки, ТТН і відстеження відправлень Нової пошти."
      states={[
        "draft",
        "creating",
        "created",
        "sent",
        "delivered",
        "returned",
        "unknown",
        "error",
        "cancelled",
      ]}
    />
  );
}
export function Returns() {
  return (
    <EntityList
      entity="returns"
      title="Повернення"
      description="Фізичні повернення товарів та окреме рішення щодо залишків."
      states={[
        "REQUESTED",
        "APPROVED",
        "IN_TRANSIT",
        "RECEIVED",
        "REFUND_PENDING",
        "CLOSED",
        "REJECTED",
      ]}
    />
  );
}
function EntityList({
  entity,
  title,
  description,
  states,
}: {
  entity: "payments" | "shipments" | "returns";
  title: string;
  description: string;
  states: string[];
}) {
  const l = useList<Payment & Shipment & Return>(entity);
  return (
    <>
      <PageHead eyebrow="ОПЕРАЦІЇ" title={title} description={description} />
      <div className="panel">
        <ListToolbar
          search={l.search}
          onSearch={l.setSearch}
          state={l.state}
          onState={l.setState}
          states={states}
        />
        {l.query.isPending ? (
          <Loading />
        ) : l.query.isError ? (
          <ErrorBox error={l.query.error} />
        ) : (
          <>
            {l.query.data.rows.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Запис</th>
                      <th>Замовлення</th>
                      <th>Стан</th>
                      <th>
                        {entity === "payments"
                          ? "Сума"
                          : entity === "shipments"
                            ? "Постачальник"
                            : "Рішення щодо залишків"}
                      </th>
                      <th>Створено</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {l.query.data.rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link
                            className="strong"
                            to={"/" + entity + "/" + r.id}
                          >
                            {entity === "payments"
                              ? r.invoice_id || "Рахунок #" + r.id
                              : entity === "shipments"
                                ? r.tracking_number || "Чернетка #" + r.id
                                : "Повернення #" + r.id}
                          </Link>
                        </td>
                        <td>
                          <Link to={"/orders/" + r.order_id}>
                            {r.order_number}
                          </Link>
                        </td>
                        <td>
                          <Badge
                            value={entity === "returns" ? r.state : r.status}
                          />
                        </td>
                        <td>
                          {entity === "payments"
                            ? money(r.amount / 100)
                            : entity === "shipments"
                              ? r.supplier_code
                              : label(r.inventory_decision)}
                        </td>
                        <td>{date(r.created_at, true)}</td>
                        <td>
                          <Link
                            aria-label={"Відкрити запис " + r.id}
                            to={"/" + entity + "/" + r.id}
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Записів немає"
                description="Операції створюються з відповідного замовлення."
              />
            )}
            <Pager page={l.query.data.pagination} onChange={l.setPage} />
          </>
        )}
      </div>
    </>
  );
}
export function PaymentPage() {
  const { id } = useParams(),
    client = useQueryClient(),
    { notify } = useContext(Workspace);
  const can = useCan("payment.refund.execute");
  const [open, setOpen] = useState(false),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [key, setKey] = useState(requestId());
  const q = useQuery({
    queryKey: ["payment", id],
    queryFn: () =>
      api<{
        record: Payment;
        order: Order;
        events: { status: string; created_at: string }[];
        refunds: Refund[];
      }>("/payments/" + id),
  });
  const m = useMutation({
    mutationFn: () =>
      api("/payments/" + id + "/refund", {
        version: q.data!.order.version,
        request_id: key,
        amount,
        reason,
      }),
    onSuccess: () => {
      client.invalidateQueries();
      setOpen(false);
      setKey(requestId());
      notify("Результат повернення збережено");
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const { record: p, order: o, refunds } = q.data;
  const held = refunds
    .filter((r) => ["success", "processing", "unknown"].includes(r.status))
    .reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <Link className="back-link" to="/payments">
        ← Платежі
      </Link>
      <PageHead
        eyebrow="MONOPAY"
        title={p.invoice_id || "Рахунок #" + p.id}
        description={"Замовлення " + o.number}
        action={
          <Link className="btn" to={"/orders/" + o.id}>
            Замовлення <ArrowUpRight size={15} />
          </Link>
        }
      />
      <div className="detail-grid">
        <div>
          <Section title="Платіж">
            <dl className="detail-data">
              <dt>Стан</dt>
              <dd>
                <Badge value={o.payment_status} />
              </dd>
              <dt>Сума рахунку</dt>
              <dd className="amount">{money(p.amount / 100)}</dd>
              <dt>Reference</dt>
              <dd>{p.reference}</dd>
              <dt>Створено</dt>
              <dd>{date(p.created_at, true)}</dd>
            </dl>
            <div className="panel-pad actions">
              {p.page_url && ["created", "processing"].includes(p.status) && (
                <a
                  className="btn"
                  href={p.page_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Відкрити посилання
                </a>
              )}
              {can &&
                ["PAID", "PARTIALLY_REFUNDED"].includes(
                  o.payment_status ?? "",
                ) && (
                  <button
                    className="btn danger"
                    onClick={() => {
                      setOpen(true);
                      m.reset();
                    }}
                  >
                    Повернути кошти
                  </button>
                )}
            </div>
          </Section>
          <Section title="Повернення коштів">
            {refunds.length ? (
              <div className="refund-list">
                {refunds.map((r) => (
                  <div className="record-row" key={r.id}>
                    <span>
                      {r.reason}
                      <small>{r.ext_ref}</small>
                    </span>
                    <Badge value={r.status} />
                    <strong>{money(r.amount / 100)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-pad muted">Повернень коштів немає.</p>
            )}
          </Section>
        </div>
        <Section title="Події monobank">
          <div className="timeline">
            {q.data.events.map((e, i) => (
              <div key={i}>
                <i />
                <Badge value={e.status} />
                <small>{date(e.created_at, true)}</small>
              </div>
            ))}
          </div>
        </Section>
      </div>
      {open && (
        <Dialog title="Повернення коштів" onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <p>
              Доступний залишок:{" "}
              <strong>{money((p.amount - held) / 100)}</strong>. Ця операція не
              змінює фізичні залишки товарів.
            </p>
            <label>
              Сума, грн
              <input
                type="number"
                min="0.01"
                max={(p.amount - held) / 100}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Причина
              <textarea
                required
                minLength={6}
                maxLength={400}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {m.isError && <ErrorBox error={m.error} />}
            <div className="dialog-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setOpen(false)}
              >
                Назад
              </button>
              <button className="btn danger" disabled={m.isPending}>
                {m.isPending ? "Очікуємо відповідь…" : "Виконати повернення"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function ShipmentPage() {
  const { id } = useParams(),
    client = useQueryClient(),
    { notify } = useContext(Workspace),
    can = useCan("shipment.manage");
  const q = useQuery({
    queryKey: ["shipment", id],
    queryFn: () =>
      api<{ record: Shipment; order: Order; notes: Note[] }>(
        "/shipments/" + id,
      ),
  });
  const [action, setAction] = useState("");
  const m = useMutation({
    mutationFn: () =>
      api("/shipments/" + id + "/" + action, {
        version: q.data!.order.version,
      }),
    onSuccess: () => {
      client.invalidateQueries();
      setAction("");
      notify("Відправлення оновлено");
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const { record: s, order: o } = q.data;
  const lines = JSON.parse(s.lines_json || "[]") as {
    line_no: number;
    qty: number;
  }[];
  return (
    <>
      <Link className="back-link" to="/shipments">
        ← Відправлення
      </Link>
      <PageHead
        eyebrow="НОВА ПОШТА"
        title={s.tracking_number || "Чернетка #" + s.id}
        description={"Замовлення " + o.number}
        action={
          <Link className="btn" to={"/orders/" + o.id}>
            Замовлення <ArrowUpRight size={15} />
          </Link>
        }
      />
      <div className="status-line">
        <Badge value={s.status} />
        <span>{s.supplier_code}</span>
      </div>
      <div className="order-actions">
        {can && s.status === "draft" && (
          <button
            className="btn primary"
            onClick={() => {
              setAction("create");
              m.reset();
            }}
          >
            Створити ТТН
          </button>
        )}
        {can && s.tracking_number && (
          <button
            className="btn"
            onClick={() => {
              setAction("refresh");
              m.reset();
            }}
          >
            <RefreshCw size={15} />
            Оновити tracking
          </button>
        )}
        {can && ["unknown", "creating"].includes(s.status) && (
          <button
            className="btn"
            onClick={() => {
              setAction("reconcile");
              m.reset();
            }}
          >
            Звірити результат НП
          </button>
        )}
        {can && s.status === "draft" && (
          <button
            className="btn danger"
            onClick={() => {
              setAction("cancel");
              m.reset();
            }}
          >
            Скасувати чернетку
          </button>
        )}
      </div>
      {s.error && <div className="warning-box">{s.error}</div>}
      <div className="detail-grid">
        <div>
          <Section title="Товари у відправленні">
            <div className="items-list">
              {lines.map((l, i) => (
                <div className="record-row" key={i}>
                  <span>
                    {o.items[l.line_no]?.name ?? "Позиція " + l.line_no}
                    <small>{o.items[l.line_no]?.sku}</small>
                  </span>
                  <strong>{l.qty} шт.</strong>
                </div>
              ))}
            </div>
          </Section>
          <Notes entity="shipments" id={id!} notes={q.data.notes} />
        </div>
        <Section title="Дані доставки">
          <dl className="detail-data">
            <dt>Отримувач</dt>
            <dd>{String(o.contact.recipient ?? o.customer.name)}</dd>
            <dt>Телефон</dt>
            <dd>{o.customer.phone}</dd>
            <dt>Місто</dt>
            <dd>{String(o.contact.city ?? "—")}</dd>
            <dt>Адреса</dt>
            <dd>{String(o.contact.address ?? "—")}</dd>
            <dt>Параметри пакунка</dt>
            <dd>{s.package_json}</dd>
            <dt>Перевірено</dt>
            <dd>{date(s.checked_at ?? "", true)}</dd>
          </dl>
        </Section>
      </div>
      {action && (
        <Dialog title={label(action)} onClose={() => setAction("")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <p>
              {action === "create"
                ? "Створити ТТН для цієї чернетки? Профіль відправника й посилання НП буде перевірено."
                : "Підтвердіть операцію з відправленням."}
            </p>
            {m.isError && <ErrorBox error={m.error} />}
            <button className="btn primary" disabled={m.isPending}>
              Підтвердити
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function ReturnPage() {
  const { id } = useParams(),
    client = useQueryClient(),
    { user, notify } = useContext(Workspace),
    can = useCan("return.transition"),
    inventory = useCan("inventory.return");
  const q = useQuery({
    queryKey: ["return", id],
    queryFn: () =>
      api<{ record: Return; order: Order; notes: Note[] }>("/returns/" + id),
  });
  const [state, setState] = useState(""),
    [reason, setReason] = useState(""),
    [tracking, setTracking] = useState(""),
    [decision, setDecision] = useState(""),
    [evidence, setEvidence] = useState(""),
    [refundId, setRefundId] = useState("");
  const m = useMutation({
    mutationFn: () =>
      api("/returns/" + id + "/transition", {
        version: q.data!.record.version,
        state,
        reason,
        ...(refundId
          ? {
              refund_allocations: [
                {
                  refund_id: Number(refundId),
                  amount: Number(q.data!.record.refund_expected_minor),
                },
              ],
            }
          : {}),
        ...(tracking ? { tracking_number: tracking } : {}),
        ...(decision
          ? { inventory_decision: decision, inventory_evidence: evidence }
          : {}),
      }),
    onSuccess: () => {
      client.invalidateQueries();
      setState("");
      notify("Стан повернення оновлено");
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const { record: r, order: o } = q.data;
  const allowed: Record<string, string[]> = {
    REQUESTED: ["APPROVED", "REJECTED"],
    APPROVED: ["IN_TRANSIT", "RECEIVED"],
    IN_TRANSIT: ["RECEIVED"],
    RECEIVED: ["REFUND_PENDING", "CLOSED"],
    REFUND_PENDING: ["CLOSED"],
  };
  const next = (allowed[r.state] ?? []).filter(
    (v) =>
      (user.role !== "LOGISTICS" || ["IN_TRANSIT", "RECEIVED"].includes(v)) &&
      (v !== "REFUND_PENDING" || Number(r.refund_expected_minor) > 0),
  );
  return (
    <>
      <Link className="back-link" to="/returns">
        ← Повернення
      </Link>
      <PageHead
        eyebrow="ФІЗИЧНЕ ПОВЕРНЕННЯ"
        title={"Повернення #" + r.id}
        description={r.reason}
        action={
          <Link className="btn" to={"/orders/" + o.id}>
            {o.number}
            <ArrowUpRight size={15} />
          </Link>
        }
      />
      <div className="status-line">
        <Badge value={r.state} />
        <Badge value={r.inventory_decision} />
      </div>
      {can && (
        <div className="order-actions">
          {next.map((s) => (
            <button
              className="btn"
              key={s}
              onClick={() => {
                setState(s);
                setReason("");
                setDecision("");
                m.reset();
              }}
            >
              {label(s)}
            </button>
          ))}
        </div>
      )}
      <div className="detail-grid">
        <div>
          <Section title="Товари">
            <div className="items-list">
              {(
                JSON.parse(r.lines_json) as { line_no: number; qty: number }[]
              ).map((l) => (
                <div className="record-row" key={l.line_no}>
                  <span>
                    {o.items[l.line_no]?.name}
                    <small>{o.items[l.line_no]?.sku}</small>
                  </span>
                  <strong>{l.qty} шт.</strong>
                </div>
              ))}
            </div>
          </Section>
          <Notes entity="returns" id={id!} notes={q.data.notes} />
        </div>
        <Section title="Рішення щодо залишків">
          <dl className="detail-data">
            <dt>Рішення</dt>
            <dd>{label(r.inventory_decision)}</dd>
            <dt>Доказ / коментар</dt>
            <dd>{r.inventory_evidence || "—"}</dd>
            <dt>Зворотна ТТН</dt>
            <dd>{r.tracking_number || "—"}</dd>
            <dt>Оплата замовлення</dt>
            <dd>
              <Badge value={o.payment_status} />
            </dd>
          </dl>
          <p className="panel-pad muted">
            Приймання товару не повертає залишок автоматично. Потрібне окреме
            погоджене рішення.
          </p>
        </Section>
      </div>
      {state && (
        <Dialog title={label(state)} onClose={() => setState("")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <label>
              Причина
              <textarea
                required
                minLength={6}
                maxLength={400}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {state === "IN_TRANSIT" && (
              <label>
                Зворотна ТТН
                <input
                  pattern="[0-9]{14}"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </label>
            )}
            {state === "CLOSED" && r.state === "REFUND_PENDING" && (
              <label>
                Підтверджене повернення коштів ·{" "}
                {money(r.refund_expected_minor / 100)}
                <select
                  required
                  value={refundId}
                  onChange={(e) => setRefundId(e.target.value)}
                >
                  <option value="">Оберіть фінансову операцію</option>
                  {o.refunds
                    .filter((f) => f.status === "success")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        #{f.id} · {money(f.amount / 100)} · {f.reason}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {inventory && ["RECEIVED", "CLOSED"].includes(state) && (
              <>
                <label>
                  Рішення щодо залишків
                  <select
                    required={
                      state === "CLOSED" && r.inventory_decision === "PENDING"
                    }
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  >
                    <option value="">Без змін</option>
                    <option value="KEEP_COMMITTED">
                      Залишити резерв / залишок без змін
                    </option>
                    <option value="PIM_RECONCILIATION_REQUIRED">
                      Передати на звірку залишків у PIM
                    </option>
                  </select>
                </label>
                <label>
                  Доказ / коментар
                  <textarea
                    maxLength={400}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                  />
                </label>
              </>
            )}
            {m.isError && <ErrorBox error={m.error} />}
            <button className="btn primary" disabled={m.isPending}>
              Зберегти перехід
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function AuditPage() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") ?? 1);
  const q = useQuery({
    queryKey: ["audit", sp.toString()],
    queryFn: () => api<List<Audit>>("/audit?" + sp),
  });
  return (
    <>
      <PageHead
        eyebrow="КОНТРОЛЬ"
        title="Журнал дій"
        description="Незмінна історія операцій співробітників із причинами та попередніми значеннями."
      />
      <div className="panel">
        <div className="filters">
          <select
            aria-label="Тип журналу"
            value={sp.get("entity") ?? ""}
            onChange={(e) =>
              setSp(e.target.value ? { entity: e.target.value } : {})
            }
          >
            <option value="">Усі операції</option>
            {["order", "customer", "return", "sender", "staff", "security"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
          <input
            aria-label="Ідентифікатор запису"
            placeholder="ID запису"
            value={sp.get("entity_id") ?? ""}
            onChange={(e) =>
              setSp((p) => {
                e.target.value
                  ? p.set("entity_id", e.target.value)
                  : p.delete("entity_id");
                p.delete("page");
                return p;
              })
            }
          />
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorBox error={q.error} />
        ) : (
          <>
            {q.data.rows.length ? (
              <div className="audit-list">
                {q.data.rows.map((a) => (
                  <details key={a.id}>
                    <summary>
                      <span className="audit-dot" />
                      <span>
                        <strong>{label(a.action)}</strong>
                        <small>
                          {a.actor || a.actor_role} · {a.entity} #{a.entity_id}
                        </small>
                      </span>
                      <span>{date(a.created_at, true)}</span>
                      <Badge value={a.source} />
                    </summary>
                    <div>
                      <p>
                        {a.reason || "Причина не потрібна для цієї операції"}
                      </p>
                      <div className="audit-diff">
                        <div>
                          <small>Попереднє значення</small>
                          <pre>{JSON.stringify(a.old, null, 2)}</pre>
                        </div>
                        <div>
                          <small>Нове значення</small>
                          <pre>{JSON.stringify(a.new, null, 2)}</pre>
                        </div>
                      </div>
                      <small>Запит: {a.request_id}</small>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <Empty
                title="Дій не знайдено"
                description="Журнал заповнюється після виконання операцій."
              />
            )}
            <Pager
              page={{ ...q.data.pagination, page }}
              onChange={(p) =>
                setSp((v) => {
                  v.set("page", String(p));
                  return v;
                })
              }
            />
          </>
        )}
      </div>
    </>
  );
}
export function SettingsPage() {
  const q = useQuery({
      queryKey: ["settings"],
      queryFn: () => api<Settings>("/settings"),
    }),
    can = useCan("settings.manage");
  const [sender, setSender] = useState<Sender | null>(null),
    [staff, setStaff] = useState<Staff | null | "new">(null);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} />;
  return (
    <>
      <PageHead
        eyebrow="РОБОЧИЙ ПРОСТІР"
        title="Налаштування"
        description="Співробітники, ролі й підтверджені профілі відправників."
      />
      <Section
        title="Співробітники"
        meta={
          can && (
            <button className="btn small" onClick={() => setStaff("new")}>
              <Plus size={15} />
              Додати
            </button>
          )
        }
      >
        <div className="staff-list">
          {q.data.staff.map((s) => (
            <div key={s.id}>
              <span className="avatar">{s.name.slice(0, 2)}</span>
              <span>
                <strong>{s.name}</strong>
                <small>{s.email}</small>
              </span>
              <Badge value={s.role} />
              <span className="muted">
                {s.enabled === 0 ? "Вимкнено" : "Активний"}
              </span>
              {can && (
                <button className="btn small" onClick={() => setStaff(s)}>
                  Редагувати
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Профілі відправників">
        <div className="sender-grid">
          {q.data.sender_profiles.map((s) => (
            <div key={s.code} className="sender-card">
              <div>
                <h3>{s.name}</h3>
                <Badge
                  value={s.confirmed ? "VERIFIED" : "SENDER_PROFILE_INCOMPLETE"}
                />
              </div>
              <p>
                {s.city} · Відділення {s.branch}
                {s.cargo_branch ? " · Вантажне " + s.cargo_branch : ""}
              </p>
              <small>{s.phone || "Телефон не налаштовано"}</small>
              {can && (
                <button className="btn" onClick={() => setSender(s)}>
                  Налаштувати профіль
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Ваші права">
        <div className="permission-list">
          {q.data.permissions.map((p) => (
            <span key={p}>
              <ShieldCheck size={14} />
              {p}
            </span>
          ))}
        </div>
      </Section>
      {sender && (
        <SenderEditor sender={sender} onClose={() => setSender(null)} />
      )}
      {staff && <StaffEditor staff={staff} onClose={() => setStaff(null)} />}
    </>
  );
}
function SenderEditor({
  sender,
  onClose,
}: {
  sender: Sender;
  onClose: () => void;
}) {
  const [form, setForm] = useState(sender),
    [reason, setReason] = useState(""),
    client = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      api(
        "/settings/senders/" + sender.code,
        { ...form, confirmed: !!form.confirmed, reason },
        "PUT",
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["settings"] });
      onClose();
    },
  });
  return (
    <Dialog title={"Відправник · " + sender.name} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <p>
          Використовуйте справжні посилання з кабінету Нової пошти. Неповний
          профіль не може створювати ТТН.
        </p>
        <div className="form-grid">
          {[
            ["name", "Назва"],
            ["city", "Місто"],
            ["region", "Область"],
            ["branch", "Відділення"],
            ["cargo_branch", "Вантажне відділення"],
            ["city_ref", "City Ref"],
            ["warehouse_ref", "Warehouse Ref"],
            ["cargo_warehouse_ref", "Cargo Warehouse Ref"],
            ["sender_ref", "Counterparty Ref"],
            ["contact_ref", "Contact Person Ref"],
            ["phone", "Телефон"],
          ].map(([k, t]) => (
            <label key={k}>
              {t}
              <input
                value={String(form[k as keyof Sender])}
                maxLength={400}
                onChange={(e) =>
                  setForm((v) => ({ ...v, [k]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={!!form.confirmed}
            onChange={(e) =>
              setForm((v) => ({ ...v, confirmed: e.target.checked ? 1 : 0 }))
            }
          />
          Дані перевірено
        </label>
        <label>
          Причина зміни
          <textarea
            required
            minLength={6}
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {m.isError && <ErrorBox error={m.error} />}
        <button className="btn primary" disabled={m.isPending}>
          Зберегти профіль
        </button>
      </form>
    </Dialog>
  );
}
function StaffEditor({
  staff,
  onClose,
}: {
  staff: Staff | "new";
  onClose: () => void;
}) {
  const old = staff === "new" ? null : staff;
  const [name, setName] = useState(old?.name ?? ""),
    [email, setEmail] = useState(old?.email ?? ""),
    [role, setRole] = useState(old?.role ?? "MANAGER"),
    [enabled, setEnabled] = useState(old?.enabled !== 0),
    [password, setPassword] = useState(""),
    [reason, setReason] = useState("");
  const client = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      api(
        "/settings/staff" + (old ? "/" + old.id : ""),
        {
          name,
          email,
          role,
          enabled,
          reason,
          session_version: old?.session_version,
          ...(password ? { password } : {}),
        },
        old ? "PUT" : "POST",
      ),
    onSuccess: () => {
      setPassword("");
      client.invalidateQueries();
      onClose();
    },
  });
  return (
    <Dialog
      title={old ? "Редагувати співробітника" : "Новий співробітник"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <label>
          Ім’я
          <input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Роль
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Staff["role"])}
          >
            {["OWNER", "MANAGER", "LOGISTICS", "READ_ONLY"].map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Пароль {old ? "(залиште порожнім, щоб зберегти)" : ""}
          <input
            required={!old}
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Активний
        </label>
        <label>
          Причина
          <textarea
            required
            minLength={6}
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <p className="muted">
          Зміна прав завершує попередні сесії цього співробітника.
        </p>
        {m.isError && <ErrorBox error={m.error} />}
        <button className="btn primary" disabled={m.isPending}>
          Зберегти
        </button>
      </form>
    </Dialog>
  );
}
