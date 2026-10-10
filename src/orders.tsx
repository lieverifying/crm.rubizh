import { useState, useContext } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronDown,
  UserPlus,
  Check,
  Link2,
  Truck,
  RotateCcw,
  RefreshCw,
  Save,
} from "lucide-react";
import { api, ApiError, params, requestId } from "./api";
import type { Order, List, Settings, Item } from "./api";
import { Workspace, useCan } from "./context";
import {
  PageHead,
  Section,
  Badge,
  Loading,
  ErrorBox,
  Empty,
  Pager,
  Drawer,
  Dialog,
  money,
  date,
  label,
  useDebounce,
} from "./ui";
const views = [
  ["all", "Усі замовлення"],
  ["mine", "Мої"],
  ["confirmation", "Підтвердження"],
  ["payment", "Очікують оплати"],
  ["shipping", "До відправлення"],
  ["transit", "У дорозі"],
  ["problems", "Проблемні"],
] as const;
export function Orders() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(sp.get("q") ?? ""),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ name: string; query: string }[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("crm.views") ?? "[]");
      } catch {
        return [];
      }
    }),
    [saveName, setSaveName] = useState(""),
    [saveOpen, setSaveOpen] = useState(false);
  const q = useDebounce(search);
  const set = (k: string, v: string) =>
    setSp((p) => {
      v ? p.set(k, v) : p.delete(k);
      if (k !== "page") p.delete("page");
      return p;
    });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/settings"),
  });
  const query = useQuery({
    queryKey: ["orders", sp.toString(), q],
    queryFn: ({ signal }) =>
      api<List<Order>>(
        "/orders?" + new URLSearchParams({ ...Object.fromEntries(sp), q }),
        undefined,
        "GET",
        signal,
      ),
  });
  return (
    <>
      <PageHead
        eyebrow="ОПЕРАЦІЇ"
        title="Замовлення"
        description="Підтвердження, оплата й відправлення кожного замовлення."
        action={
          <button className="btn" onClick={() => setSaveOpen(true)}>
            <Save size={15} />
            Зберегти вигляд
          </button>
        }
      />
      <div className="tabs">
        {views.map(([v, t]) => (
          <button
            key={v}
            className={(sp.get("view") ?? "all") === v ? "active" : ""}
            onClick={() => set("view", v)}
          >
            {t}
          </button>
        ))}
      </div>
      {saved.length > 0 && (
        <div className="saved-views">
          {saved.map((v, i) => (
            <span key={i}>
              <button
                onClick={() => {
                  setSp(v.query);
                  setSearch(new URLSearchParams(v.query).get("q") ?? "");
                }}
              >
                {v.name}
              </button>
              <button
                aria-label={"Видалити вигляд " + v.name}
                onClick={() => {
                  const next = saved.filter((_, n) => n !== i);
                  setSaved(next);
                  localStorage.setItem("crm.views", JSON.stringify(next));
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="panel order-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Пошук замовлень"
              placeholder="Номер, клієнт, телефон, SKU або ТТН"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                set("page", "1");
              }}
            />
          </div>
          <div>
            <button
              className={"btn " + (filters ? "active" : "")}
              onClick={() => setFilters((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              Фільтри
            </button>
            <select
              aria-label="Сортування замовлень"
              value={sp.get("sort") ?? "date"}
              onChange={(e) => set("sort", e.target.value)}
            >
              <option value="date">За датою</option>
              <option value="updated">За оновленням</option>
              <option value="total">За сумою</option>
              <option value="number">За номером</option>
            </select>
          </div>
        </div>
        {filters && (
          <div className="filter-grid">
            {[
              [
                "order_status",
                "Стан замовлення",
                [
                  "WAITING_CONFIRMATION",
                  "CONFIRMED",
                  "CANCELLED",
                  "COMPLETED",
                  "LEGACY_REVIEW_REQUIRED",
                ],
              ],
              [
                "payment_status",
                "Стан оплати",
                [
                  "UNPAID",
                  "PAYMENT_PENDING",
                  "PAID",
                  "PARTIALLY_REFUNDED",
                  "REFUNDED",
                ],
              ],
              [
                "fulfillment_status",
                "Стан відправлення",
                [
                  "NOT_READY",
                  "READY_TO_SHIP",
                  "PARTIALLY_SHIPPED",
                  "SHIPPED",
                  "DELIVERED",
                ],
              ],
            ].map(([key, title, options]) => (
              <label key={key as string}>
                {title}
                <select
                  value={sp.get(key as string) ?? ""}
                  onChange={(e) => set(key as string, e.target.value)}
                >
                  <option value="">Усі</option>
                  {(options as string[]).map((o) => (
                    <option key={o} value={o}>
                      {label(o)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Менеджер
              <select
                value={sp.get("manager") ?? ""}
                onChange={(e) => set("manager", e.target.value)}
              >
                <option value="">Усі</option>
                {settings.data?.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Постачальник
              <select
                value={sp.get("supplier") ?? ""}
                onChange={(e) => set("supplier", e.target.value)}
              >
                <option value="">Усі</option>
                {settings.data?.sender_profiles.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              З дати
              <input
                type="date"
                value={sp.get("from") ?? ""}
                onChange={(e) => set("from", e.target.value)}
              />
            </label>
            <label>
              До дати
              <input
                type="date"
                value={sp.get("to") ?? ""}
                onChange={(e) => set("to", e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={sp.has("has_return")}
                onChange={(e) => set("has_return", e.target.checked ? "1" : "")}
              />
              Є повернення
            </label>
            <button
              className="btn"
              onClick={() => {
                setSp({});
                setSearch("");
              }}
            >
              Скинути фільтри
            </button>
          </div>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            {query.data.rows.length ? (
              <OrderTable rows={query.data.rows} onSelect={setSelected} />
            ) : (
              <Empty
                title="Замовлень не знайдено"
                description="Змініть пошук або фільтри. Нові замовлення магазину з’являться тут."
              />
            )}
            <Pager
              page={query.data.pagination}
              onChange={(p) => set("page", String(p))}
            />
          </>
        )}
      </div>
      {selected && (
        <Drawer title="Перегляд замовлення" onClose={() => setSelected(null)}>
          <OrderDetail id={selected} compact />
        </Drawer>
      )}
      {saveOpen && (
        <Dialog title="Зберегти вигляд" onClose={() => setSaveOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const next = [
                ...saved,
                {
                  name: saveName.trim(),
                  query: new URLSearchParams({
                    ...Object.fromEntries(sp),
                    q,
                  }).toString(),
                },
              ].slice(-12);
              setSaved(next);
              localStorage.setItem("crm.views", JSON.stringify(next));
              setSaveOpen(false);
              setSaveName("");
            }}
          >
            <label>
              Назва вигляду
              <input
                value={saveName}
                maxLength={60}
                onChange={(e) => setSaveName(e.target.value)}
                required
              />
            </label>
            <button className="btn primary">Зберегти</button>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function OrderTable({
  rows,
  onSelect,
}: {
  rows: Order[];
  onSelect?: (id: number) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="order-table">
        <thead>
          <tr>
            <th>Замовлення</th>
            <th>Клієнт</th>
            <th>Товари</th>
            <th>Статус</th>
            <th>Оплата</th>
            <th>Відправлення</th>
            <th className="numeric">Сума</th>
            <th>Менеджер</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                {onSelect ? (
                  <button
                    className="order-number"
                    onClick={() => onSelect(o.id)}
                  >
                    {o.number}
                  </button>
                ) : (
                  <Link className="order-number" to={"/orders/" + o.id}>
                    {o.number}
                  </Link>
                )}
                <small>{date(o.created_at, true)}</small>
              </td>
              <td>
                <Link to={"/customers/" + encodeURIComponent(o.customer.id)}>
                  {o.customer.name || o.customer.email}
                </Link>
                <small>{o.customer.phone ?? o.customer.email}</small>
              </td>
              <td>
                <span className="item-preview">{o.items[0]?.name ?? "—"}</span>
                <small>
                  {o.items.length > 1
                    ? "+" + (o.items.length - 1) + " товарів"
                    : o.items[0]?.sku}
                </small>
              </td>
              <td>
                <Badge value={o.order_status} />
                {o.review_required && (
                  <small className="warning">Потрібна перевірка</small>
                )}
              </td>
              <td>
                <Badge value={o.payment_status} />
              </td>
              <td>
                <Badge value={o.fulfillment_status} />
                <small>{o.shipments[0]?.tracking_number}</small>
              </td>
              <td className="numeric amount">{money(o.total)}</td>
              <td>
                <span className="manager-name">
                  {o.assigned_manager?.name ?? "Не призначено"}
                </span>
                {o.latest_note && (
                  <small title={o.latest_note.body}>Є внутрішня нотатка</small>
                )}
              </td>
              <td>
                <Link
                  aria-label={"Відкрити " + o.number}
                  to={"/orders/" + o.id}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function OrderPage() {
  const { id } = useParams();
  return (
    <>
      <Link className="back-link" to="/orders">
        ← Замовлення
      </Link>
      <OrderDetail id={Number(id)} />
    </>
  );
}
export function Notes({
  entity,
  id,
  notes = [],
}: {
  entity: string;
  id: string | number;
  notes?: { id: number; body: string; author?: string; created_at: string }[];
}) {
  const [body, setBody] = useState(""),
    [noteKey, setNoteKey] = useState(requestId()),
    client = useQueryClient(),
    can = useCan("note.create");
  const mutation = useMutation({
    mutationFn: () =>
      api("/" + entity + "/" + encodeURIComponent(id) + "/note", {
        body,
        request_id: noteKey,
      }),
    onSuccess: () => {
      setBody("");
      setNoteKey(requestId());
      client.invalidateQueries();
    },
  });
  return (
    <Section title="Внутрішні нотатки">
      <div className="notes">
        {notes.map((n) => (
          <div key={n.id}>
            <p>{n.body}</p>
            <small>
              {n.author ?? "Співробітник"} · {date(n.created_at, true)}
            </small>
          </div>
        ))}
        {!notes.length && <p className="muted">Нотаток ще немає.</p>}
      </div>
      {can && (
        <form
          className="note-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <textarea
            aria-label="Внутрішня нотатка"
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Додати контекст для команди…"
            required
          />
          {mutation.isError && <ErrorBox error={mutation.error} />}
          <button className="btn" disabled={mutation.isPending}>
            Додати нотатку
          </button>
        </form>
      )}
    </Section>
  );
}
export function OrderDetail({
  id,
  compact = false,
}: {
  id: number;
  compact?: boolean;
}) {
  const client = useQueryClient(),
    { notify, user } = useContext(Workspace),
    canConfirm = useCan("order.confirm"),
    canAssign = useCan("order.assign.self"),
    canInvoice = useCan("payment.invoice.create"),
    canShip = useCan("shipment.manage"),
    canReturn = useCan("return.create");
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: ({ signal }) =>
      api<Order>("/orders/" + id, undefined, "GET", signal),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/settings"),
  });
  const [action, setAction] = useState(""),
    [operationKey, setOperationKey] = useState(requestId()),
    [reason, setReason] = useState(""),
    [availability, setAvailability] = useState(false),
    [delivery, setDelivery] = useState(false),
    [resolution, setResolution] = useState<Record<string, string>>({}),
    [supplier, setSupplier] = useState(""),
    [weight, setWeight] = useState(""),
    [length, setLength] = useState(""),
    [width, setWidth] = useState(""),
    [height, setHeight] = useState(""),
    [lineQty, setLineQty] = useState<Record<number, string>>({}),
    [approval, setApproval] = useState<Record<string, unknown> | null>(null);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Order | unknown>(
        action === "return" ? "/returns" : "/orders/" + id + "/" + action,
        { ...body, version: q.data!.version },
      ),
    onSuccess: () => {
      client.invalidateQueries();
      notify("Дію виконано");
      setAction("");
      setApproval(null);
      setReason("");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "STALE_ORDER") q.refetch();
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data;
  const open = (a: string) => {
    setAction(a);
    setOperationKey(requestId());
    setAvailability(false);
    setReason("");
    setResolution({});
    setApproval(null);
    mutation.reset();
  };
  const run = () => {
    const lines = Object.entries(lineQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([no, qty]) => ({ line_no: Number(no), qty: Number(qty) }));
    const body =
      action === "return"
        ? { order_id: id, request_id: operationKey, reason, lines }
        : action === "shipments"
          ? {
              request_id: operationKey,
              availability_confirmed: availability,
              extra_delivery_agreed: delivery,
              supplier_code: supplier,
              lines,
              package: {
                places: [
                  {
                    weight: Number(weight),
                    length: Number(length),
                    width: Number(width),
                    height: Number(height),
                  },
                ],
              },
            }
          : action === "confirm" || action === "resolve-item"
            ? {
                availability_confirmed: availability,
                extra_delivery_agreed: delivery,
                resolution,
                approval: approval ? { ...approval, reason } : undefined,
              }
            : action === "manual-reconcile"
              ? { invoice_id: o.payments.at(-1)?.invoice_id, reason }
              : { reason };
    mutation.mutate(body);
  };
  return (
    <>
      <PageHead
        eyebrow={compact ? "ЗАМОВЛЕННЯ" : date(o.created_at, true)}
        title={o.number}
        description={o.customer.name}
        action={
          compact ? (
            <Link className="btn" to={"/orders/" + id}>
              Повна сторінка <ArrowUpRight size={15} />
            </Link>
          ) : (
            <button className="btn" onClick={() => q.refetch()}>
              <RefreshCw size={15} />
              Оновити
            </button>
          )
        }
      />
      <div className="status-line">
        <Badge value={o.order_status} />
        <Badge value={o.payment_status} />
        <Badge value={o.fulfillment_status} />
      </div>
      {o.review_required && (
        <div className="warning-box">
          Історичне замовлення потребує перевірки:{" "}
          {o.review_flags.map(label).join(", ")}
        </div>
      )}
      {o.blockers.length > 0 && (
        <div className="warning-box">{o.blockers.map(label).join(" · ")}</div>
      )}
      <div className="order-actions">
        {canAssign && (
          <button
            className="btn"
            onClick={() => {
              setAction("assign");
              mutation.reset();
            }}
          >
            <UserPlus size={15} />
            Взяти в роботу
          </button>
        )}
        {canConfirm && o.order_status === "WAITING_CONFIRMATION" && (
          <button className="btn primary" onClick={() => open("confirm")}>
            <Check size={15} />
            Підтвердити
          </button>
        )}
        {canInvoice &&
          o.order_status === "CONFIRMED" &&
          ["UNPAID", "PAYMENT_PENDING"].includes(o.payment_status ?? "") && (
            <button className="btn primary" onClick={() => open("invoice")}>
              <Link2 size={15} />
              Платіжне посилання
            </button>
          )}
        {canShip &&
          ["PAID", "PARTIALLY_REFUNDED"].includes(o.payment_status ?? "") && (
            <button
              className="btn"
              onClick={() => {
                open("shipments");
                setLineQty({});
                setSupplier(o.fulfillment_lines[0]?.supplier_code ?? "");
              }}
            >
              <Truck size={15} />
              Додати відправлення
            </button>
          )}
        {canReturn &&
          ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
            o.payment_status ?? "",
          ) && (
            <button
              className="btn"
              onClick={() => {
                open("return");
                setLineQty({});
              }}
            >
              <RotateCcw size={15} />
              Оформити повернення
            </button>
          )}
        {useCanStatic(user.permissions, "order.cancel") &&
          ["WAITING_CONFIRMATION", "CONFIRMED"].includes(
            o.order_status ?? "",
          ) &&
          ["UNPAID", "PAYMENT_PENDING"].includes(o.payment_status ?? "") && (
            <button className="btn danger" onClick={() => open("cancel")}>
              Скасувати
            </button>
          )}
        {useCanStatic(user.permissions, "payment.manual_reconcile") &&
          o.payments.length > 0 && (
            <button className="btn" onClick={() => open("manual-reconcile")}>
              Звірити з MonoPay
            </button>
          )}
      </div>
      <div className={compact ? "detail-stack" : "detail-grid"}>
        <div>
          <Section
            title="Склад замовлення"
            meta={<span className="muted">{o.items.length} позицій</span>}
          >
            <div className="items-list">
              {o.items.map((item, i) => (
                <ItemRow key={i} item={item} />
              ))}
            </div>
            <div className="totals">
              <span>
                Товари<strong>{money(o.subtotal)}</strong>
              </span>
              <span>
                Знижка<strong>−{money(o.discount)}</strong>
              </span>
              <span>
                Доставка<strong>{money(o.shipping)}</strong>
              </span>
              <span className="grand-total">
                До сплати<strong>{money(o.total)}</strong>
              </span>
            </div>
          </Section>
          <Section title="Оплати">
            {o.payments.length ? (
              o.payments.map((p) => (
                <Link
                  className="record-row"
                  key={p.id}
                  to={"/payments/" + p.id}
                >
                  <span>
                    MonoPay · {p.invoice_id}
                    <small>{date(p.created_at, true)}</small>
                  </span>
                  <Badge value={p.status} />
                  <strong>{money(p.amount / 100)}</strong>
                </Link>
              ))
            ) : (
              <p className="panel-pad muted">Рахунок ще не створено.</p>
            )}
            {o.payments.find(
              (p) => p.page_url && ["created", "processing"].includes(p.status),
            ) && (
              <a
                className="btn panel-link"
                href={o.payments.find((p) => p.page_url)?.page_url}
                target="_blank"
                rel="noreferrer"
              >
                Відкрити платіжне посилання <ArrowUpRight size={14} />
              </a>
            )}
          </Section>
          <Section title="Відправлення">
            {o.shipments.length ? (
              o.shipments.map((s) => (
                <Link
                  className="record-row"
                  key={s.id}
                  to={"/shipments/" + s.id}
                >
                  <span>
                    {s.tracking_number || "Чернетка #" + s.id}
                    <small>{s.supplier_code}</small>
                  </span>
                  <Badge value={s.status} />
                  <ArrowUpRight size={15} />
                </Link>
              ))
            ) : (
              <p className="panel-pad muted">Відправлення ще не додано.</p>
            )}
          </Section>
          {o.returns.length > 0 && (
            <Section title="Повернення">
              {o.returns.map((r) => (
                <Link className="record-row" key={r.id} to={"/returns/" + r.id}>
                  <span>Повернення #{r.id}</span>
                  <Badge value={r.state} />
                </Link>
              ))}
            </Section>
          )}
          <Notes entity="orders" id={id} notes={o.notes} />
        </div>
        <div>
          <Section title="Клієнт">
            <dl className="detail-data">
              <dt>Ім’я</dt>
              <dd>
                <Link to={"/customers/" + encodeURIComponent(o.customer.id)}>
                  {o.customer.name || "—"}
                </Link>
              </dd>
              <dt>Телефон</dt>
              <dd>
                {o.customer.phone ?? "—"}
                <small>
                  {o.customer.phone_verified
                    ? "Підтверджений контакт"
                    : "Контакт замовлення"}
                </small>
              </dd>
              <dt>Email</dt>
              <dd>{o.customer.email || "—"}</dd>
              <dt>Отримувач</dt>
              <dd>{String(o.contact.recipient ?? "—")}</dd>
              <dt>Місто</dt>
              <dd>{String(o.contact.city ?? "—")}</dd>
              <dt>Адреса</dt>
              <dd>{String(o.contact.address ?? "—")}</dd>
              <dt>Менеджер</dt>
              <dd>{o.assigned_manager?.name ?? "Не призначено"}</dd>
            </dl>
          </Section>
          <Section title="Історія замовлення">
            <div className="timeline">
              {o.timeline.length ? (
                o.timeline.map((e, i) => (
                  <div key={i}>
                    <i />
                    <strong>{label(e.event)}</strong>
                    <small>{date(e.occurred_at, true)}</small>
                  </div>
                ))
              ) : (
                <p className="muted">Подій ще немає.</p>
              )}
              <Link
                className="text-link"
                to={"/audit?entity=order&entity_id=" + id}
              >
                Журнал дій <ArrowUpRight size={14} />
              </Link>
            </div>
          </Section>
        </div>
      </div>
      {action && (
        <Dialog
          title={label(action)}
          onClose={() => setAction("")}
          wide={action === "confirm"}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            {action === "assign" ? (
              <p>Призначити себе відповідальним за {o.number}?</p>
            ) : action === "invoice" ? (
              <p>
                Перед створенням посилання система повторно перевірить склад,
                наявність і поточну ціну.
              </p>
            ) : action === "confirm" || action === "resolve-item" ? (
              <>
                <p>Перевірте наявність і погоджені умови замовлення.</p>
                {o.sku_candidates.map((c) => (
                  <label key={c.line_no}>
                    Позиція {c.line_no + 1}
                    <select
                      required
                      value={resolution[c.line_no] ?? ""}
                      onChange={(e) =>
                        setResolution((v) => ({
                          ...v,
                          [c.line_no]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Оберіть реальний SKU</option>
                      {c.skus.map((s) => (
                        <option key={s.sku} value={s.sku}>
                          {s.label || s.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={availability}
                    onChange={(e) => setAvailability(e.target.checked)}
                  />
                  Наявність підтверджено
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={delivery}
                    onChange={(e) => setDelivery(e.target.checked)}
                  />
                  Умови додаткової доставки погоджено
                </label>
              </>
            ) : action === "return" || action === "shipments" ? (
              <>
                {action === "shipments" && (
                  <>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        required
                        checked={availability}
                        onChange={(e) => setAvailability(e.target.checked)}
                      />
                      Фактичну наявність і комплектацію перевірено
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={delivery}
                        onChange={(e) => setDelivery(e.target.checked)}
                      />
                      Доставку кожної окремої посилки погоджено
                    </label>
                    <label>
                      Постачальник
                      <select
                        required
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                      >
                        <option value="">Оберіть</option>
                        {settings.data?.sender_profiles.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Вага, кг
                      <input
                        required
                        type="number"
                        min="0.1"
                        max="1000"
                        step="0.1"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                      />
                    </label>
                    <div className="form-grid">
                      {[
                        ["Довжина, см", length, setLength],
                        ["Ширина, см", width, setWidth],
                        ["Висота, см", height, setHeight],
                      ].map(([title, v, update]) => (
                        <label key={title as string}>
                          {title as string}
                          <input
                            required
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={v as string}
                            onChange={(e) =>
                              (update as (v: string) => void)(e.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {o.items.map((item, i) => (
                  <label key={i}>
                    {item.name} · {item.sku}
                    <input
                      aria-label={"Кількість позиції " + (i + 1)}
                      type="number"
                      min="0"
                      max={item.qty}
                      step="0.01"
                      placeholder="Кількість"
                      value={lineQty[i] ?? ""}
                      onChange={(e) =>
                        setLineQty((v) => ({ ...v, [i]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <p className="muted">
                  Повернення товару й повернення коштів — окремі операції.
                </p>
              </>
            ) : (
              <p>Підтвердіть операцію для {o.number}.</p>
            )}
            {["return", "cancel", "manual-reconcile"].includes(action) ||
            approval ? (
              <label>
                Причина
                <textarea
                  minLength={6}
                  maxLength={400}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            ) : null}
            {mutation.isError && <ErrorBox error={mutation.error} />}
            {mutation.error instanceof ApiError &&
              mutation.error.code === "PRICE_CHANGED" && (
                <div className="warning-box">
                  <PriceConflict details={mutation.error.details} />
                  {user.role === "OWNER" ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setApproval(
                          mutation.error instanceof ApiError
                            ? { quote_hash: mutation.error.details.quote_hash }
                            : null,
                        )
                      }
                    >
                      Погодити нову ціну з причиною
                    </button>
                  ) : (
                    <p>
                      Потрібне погодження власника. Передайте замовлення OWNER.
                    </p>
                  )}
                </div>
              )}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setAction("")}
              >
                Назад
              </button>
              <button className="btn primary" disabled={mutation.isPending}>
                {mutation.isPending ? "Виконуємо…" : "Підтвердити дію"}
                <Check size={15} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
function useCanStatic(permissions: string[], permission: string) {
  return permissions.includes(permission);
}
function ItemRow({ item }: { item: Item }) {
  return (
    <div className="item-row">
      <div className="product-thumb">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" />
        ) : (
          <span>{item.name?.slice(0, 1)}</span>
        )}
      </div>
      <div className="item-description">
        <strong>{item.name}</strong>
        <small>
          {item.sku} · {item.color || item.color_id} ·{" "}
          {item.size || "Без розміру"}
        </small>
        {item.selection_type === "SIZE_OPTION" && (
          <Badge value="SIZE_CONFIRMATION_REQUIRED" />
        )}
        {item.requires_order_confirmation && (
          <small className="warning">Потребує підтвердження</small>
        )}
      </div>
      <span>
        {item.qty} × {money(item.price)}
      </span>
      <strong>{money(item.amount ?? item.qty * item.price)}</strong>
    </div>
  );
}

function PriceConflict({ details }: { details: Record<string, unknown> }) {
  const quote = details.quote as { total: number; lines: Item[] } | undefined;
  return (
    <div>
      <p>Ціна змінилась. Потрібне явне погодження власника.</p>
      <div className="conflict-totals">
        <span>
          Попередня сума <strong>{money(details.old_total as number)}</strong>
        </span>
        <span>
          Актуальна сума <strong>{money(quote?.total)}</strong>
        </span>
      </div>
      {quote?.lines.map((item, i) => (
        <div className="record-row" key={i}>
          <span>
            {item.name}
            <small>
              {item.sku} · {item.qty} шт.
            </small>
          </span>
          <strong>{money(item.amount ?? item.price * item.qty)}</strong>
        </div>
      ))}
    </div>
  );
}
