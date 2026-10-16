import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, Phone } from "lucide-react";
import type {
  CustomerDetail,
  CustomerList,
  Order,
  ShipmentDetail,
  ShipmentList,
  AssigneeList,
  WholesaleDetail,
  WholesaleList,
} from "./contract.gen";
import {
  api,
  ApiError,
  copy,
  date,
  download,
  money,
  params,
  telHref,
  useAttemptKey,
  useCan,
  useWorkspace,
} from "./lib";
import type { Column } from "./kit";
import {
  ActionDialog,
  DataView,
  Empty,
  ErrorBox,
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

type Cust = {
  id: string;
  name: string | null;
  email: string;
  phone_masked: string | null;
  segment: string;
  orders: number;
  paid_total_minor: number | null;
  last_order: string | null;
  source: string;
};
export function Customers() {
  const can = useCan();
  const { notify } = useWorkspace();
  const [sp, setSp] = useSearchParams();
  const [text, setText] = useState(sp.get("q") ?? "");
  const q = useDebounce(text);
  const segment = sp.get("segment") ?? "";
  const query = { q, segment, page: sp.get("page") ?? "1", limit: "25" };
  const list = useQuery({
    queryKey: ["customers", query],
    queryFn: () => api<CustomerList>("/customers" + params(query)),
    placeholderData: (p) => p,
    enabled: segment !== "WHOLESALE",
  });
  const [full, setFull] = useState(false);
  const columns: Column<Cust>[] = [
    {
      key: "name",
      title: "Клієнт",
      render: (c) => (
        <>
          <Link className="link" to={"/customers/" + encodeURIComponent(c.id)}>
            {c.name || c.email || "—"}
          </Link>
          <small>
            {c.source === "ACCOUNT" ? "кабінет" : "гостьове замовлення"}
          </small>
        </>
      ),
    },
    {
      key: "phone",
      title: "Телефон",
      render: (c) => <span className="num">{c.phone_masked ?? "—"}</span>,
    },
    {
      key: "segment",
      title: "Сегмент",
      render: (c) => (
        <Pill
          code={
            c.segment === "VIP"
              ? "PAID"
              : c.segment === "SLEEPING"
                ? "AWAITING"
                : ""
          }
        >
          {t.segment[c.segment]}
        </Pill>
      ),
    },
    {
      key: "orders",
      title: "Замовлень",
      className: "right",
      render: (c) => c.orders,
    },
    {
      key: "paid",
      title: "Оплачено",
      className: "right",
      render: (c) => <span className="num">{money(c.paid_total_minor)}</span>,
    },
    { key: "last", title: "Останнє", render: (c) => date(c.last_order) },
  ];
  return (
    <>
      <PageHead
        title={t.nav.customers}
        text="Дані з SITE: кабінети й гостьові замовлення. Телефони — з маскою; повний номер відкривається з записом у журнал."
        actions={
          <>
            {can("export.customers") && (
              <button
                className="btn"
                onClick={() =>
                  download("/customers/export" + params({ q })).catch((e) =>
                    notify(e.message, "error"),
                  )
                }
              >
                <Download size={16} aria-hidden="true" /> Експорт
              </button>
            )}
            {can("export.full") && (
              <button className="btn" onClick={() => setFull(true)}>
                Повний експорт
              </button>
            )}
          </>
        }
      />
      <Panel>
        <Tabs
          items={[
            ["", "Усі"],
            ["VIP", "VIP"],
            ["REPEAT", "Повторні"],
            ["NEW", "Нові"],
            ["SLEEPING", "Сплячі"],
            ...(can("wholesale.view")
              ? [["WHOLESALE", "Оптові заявки"] as [string, string]]
              : []),
          ]}
          value={segment}
          onChange={(v) => setSp(v ? { segment: v } : {})}
        />
        {segment === "WHOLESALE" ? (
          <Wholesale />
        ) : (
          <>
            <div className="toolbar">
              <SearchBox
                value={text}
                onChange={setText}
                placeholder="Ім’я, email або телефон"
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
                  rows={list.data.rows as Cust[]}
                  columns={columns}
                  rowKey={(c) => c.id}
                  card={(c) => (
                    <Link
                      className="mcard"
                      to={"/customers/" + encodeURIComponent(c.id)}
                    >
                      <div className="mcard-top">
                        <strong>{c.name || c.email}</strong>
                        <Pill code="">{t.segment[c.segment]}</Pill>
                      </div>
                      <span className="sub">
                        {c.phone_masked} · {c.orders} замовл.
                      </span>
                    </Link>
                  )}
                />
                <Pager
                  page={list.data.pagination}
                  onChange={(n) =>
                    setSp({ ...(segment ? { segment } : {}), page: String(n) })
                  }
                />
              </>
            )}
          </>
        )}
      </Panel>
      {full && (
        <ActionDialog
          title="Повний експорт клієнтів"
          needReason
          onClose={() => setFull(false)}
          onSubmit={async ({ reason }) => {
            await download("/customers/export-full", { reason });
          }}
        >
          <Note>
            Файл міститиме повні телефони та email. Зберігайте його лише на
            захищеному пристрої. Дія записується в журнал.
          </Note>
        </ActionDialog>
      )}
    </>
  );
}

// D-54: storefront «Запит на прорахунок» requests (SITE table), worked by OWNER / MANAGER.
type WholesaleRow = {
  id: number;
  number: string;
  name: string;
  phone_masked: string | null;
  buyer_type: string;
  tax_id: string;
  email: string;
  kits: number | null;
  composition: string;
  priority: string;
  state: string;
  manager_note: string;
  created_at: string;
  assignee: { id: string; name: string } | null;
  order: { id: number; number: string } | null;
};
/** OD-4.6: нова / в роботі / КП надіслано / закрита. */
const WS_STATE: Record<string, string> = {
  NEW: "Нова",
  IN_PROGRESS: "В роботі",
  QUOTE_SENT: "КП надіслано",
  CLOSED: "Закрита",
};
const WS_BUYER: Record<string, string> = {
  PERSON: "Фізособа",
  FOP: "ФОП",
  LLC: "ТОВ",
  CHARITY: "Благодійний фонд",
  MILITARY: "Військова частина",
};
/** Masked number; the full one only on request (audited, limited per hour — R4-05). */
function WsPhone({ r }: { r: WholesaleRow }) {
  const { notify } = useWorkspace();
  const [phone, setPhone] = useState<string | null>(null);
  if (phone)
    return (
      <a className="link num" href={telHref(phone)}>
        {phone}
      </a>
    );
  return (
    <span className="num">
      {r.phone_masked ?? "—"}{" "}
      <button
        type="button"
        className="btn small ghost"
        onClick={async () => {
          try {
            setPhone(
              (await api<{ phone: string }>(`/wholesale/${r.id}/phone`, {}))
                .phone,
            );
          } catch (e) {
            notify((e as Error).message, "error");
          }
        }}
      >
        Показати
      </button>
    </span>
  );
}
function Wholesale() {
  const can = useCan();
  const [sp, setSp] = useSearchParams();
  const page = sp.get("page") ?? "1";
  const list = useQuery({
    queryKey: ["wholesale", page],
    queryFn: () =>
      api<WholesaleList>("/wholesale" + params({ page, limit: "25" })),
    placeholderData: (p) => p,
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const columns: Column<WholesaleRow>[] = [
    {
      key: "number",
      title: "Заявка",
      render: (r) => (
        <>
          <span className="num">{r.number}</span>
          <small>{date(r.created_at)}</small>
        </>
      ),
    },
    {
      key: "buyer",
      title: "Покупець",
      render: (r) => (
        <>
          {r.name}
          <small>
            {WS_BUYER[r.buyer_type] ?? r.buyer_type}
            {r.tax_id ? " · " + r.tax_id : ""}
          </small>
        </>
      ),
    },
    {
      key: "phone",
      title: "Контакт",
      render: (r) => (
        <>
          <WsPhone r={r} />
          {r.email && <small>{r.email}</small>}
        </>
      ),
    },
    {
      key: "composition",
      title: "Склад",
      render: (r) => (
        <>
          {r.kits ? r.kits + " компл. · " : ""}
          {r.composition}
          <small>
            {r.priority === "DONATION" ? "Більший донат бригаді" : "Нижча ціна"}
          </small>
        </>
      ),
    },
    {
      key: "state",
      title: "Статус",
      render: (r) => (
        <>
          <Pill
            code={
              r.state === "CLOSED" ? "" : r.state === "NEW" ? "AWAITING" : ""
            }
          >
            {WS_STATE[r.state] ?? r.state}
          </Pill>
          <small>{r.assignee ? r.assignee.name : "Не призначено"}</small>
          {r.order && (
            <small>
              <Link className="link" to={"/orders/" + r.order.id}>
                {r.order.number}
              </Link>
            </small>
          )}
        </>
      ),
    },
    {
      key: "act",
      title: "",
      render: (r) => (
        <button className="btn sm" onClick={() => setOpenId(r.id)}>
          {can("wholesale.manage") ? "Відкрити" : "Деталі"}
        </button>
      ),
    },
  ];
  if (list.isPending) return <Loading rows={5} />;
  if (list.isError)
    return <ErrorBox error={list.error} onRetry={() => void list.refetch()} />;
  const rows = list.data.rows as WholesaleRow[];
  return (
    <>
      <Note>
        Заявки з форми «Запит на прорахунок» на головній. Не зберігайте в
        коментарях номери частин, місця дислокації чи прізвища військових.
      </Note>
      {!rows.length ? (
        <Empty />
      ) : (
        <>
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => String(r.id)}
            card={(r) => (
              <div className="mcard">
                <div className="mcard-top">
                  <strong className="num">{r.number}</strong>
                  <Pill code="">{WS_STATE[r.state] ?? r.state}</Pill>
                </div>
                <span>
                  {r.name} · {WS_BUYER[r.buyer_type] ?? r.buyer_type}
                </span>
                <WsPhone r={r} />
                <span className="sub">{r.composition}</span>
                <span className="sub">
                  {r.assignee ? r.assignee.name : "Не призначено"}
                </span>
                <button className="btn sm" onClick={() => setOpenId(r.id)}>
                  {can("wholesale.manage") ? "Відкрити" : "Деталі"}
                </button>
              </div>
            )}
          />
          <Pager
            page={list.data.pagination}
            onChange={(n) => setSp({ segment: "WHOLESALE", page: String(n) })}
          />
        </>
      )}
      {openId !== null && rows.some((r) => r.id === openId) && (
        <WholesaleCard
          key={openId}
          row={rows.find((r) => r.id === openId)!}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

/** OD-4.6: status, assignee, comments and history of one request; an order is made from it in «Нове замовлення». */
function WholesaleCard({
  row,
  onClose,
}: {
  row: WholesaleRow;
  onClose: () => void;
}) {
  const can = useCan();
  const qc = useQueryClient();
  const { notify } = useWorkspace();
  const manage = can("wholesale.manage");
  const detail = useQuery({
    queryKey: ["wholesale", "detail", String(row.id)],
    queryFn: () => api<WholesaleDetail>("/wholesale/" + row.id),
  });
  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => api<AssigneeList>("/staff/assignees"),
    enabled: manage,
  });
  const [state, setState] = useState(row.state);
  const [assignee, setAssignee] = useState(row.assignee?.id ?? "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const commentKey = useAttemptKey();
  const notes = (detail.data?.notes ?? []) as {
    id: number;
    body: string;
    author: string | null;
    created_at: string;
  }[];
  const addComment = async () => {
    setBusy(true);
    try {
      await api(
        "/wholesale/" + row.id + "/note",
        { body: comment.trim() },
        { idem: commentKey.key },
      );
      commentKey.renew();
      setComment("");
      await qc.invalidateQueries({ queryKey: ["wholesale"] });
    } catch (e) {
      commentKey.afterError(e);
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  // The current assignee stays visible even while the list loads or when they are no longer assignable.
  const assigneeRows = (assignees.data?.rows ?? []) as {
    id: string;
    name: string;
  }[];
  const assigneeOptions =
    row.assignee && !assigneeRows.some((u) => u.id === row.assignee!.id)
      ? [row.assignee, ...assigneeRows]
      : assigneeRows;
  return (
    <ActionDialog
      title={"Заявка " + row.number}
      wide
      submitText="Зберегти"
      disabled={!manage}
      onClose={onClose}
      onSubmit={async ({ key }) => {
        await api(
          "/wholesale/" + row.id,
          { state, assignee: assignee || null },
          { idem: key },
        );
        await qc.invalidateQueries({ queryKey: ["wholesale"] });
      }}
    >
      <p>
        {row.name} · {WS_BUYER[row.buyer_type] ?? row.buyer_type} ·{" "}
        <WsPhone r={row} />
      </p>
      <p className="muted">
        {row.kits ? row.kits + " компл. · " : ""}
        {row.composition}
      </p>
      {manage && (
        <>
          <label className="field">
            Статус
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {Object.entries(WS_STATE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Відповідальний
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Не призначено</option>
              {assigneeOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {row.order ? (
        <p>
          Замовлення:{" "}
          <Link className="link" to={"/orders/" + row.order.id}>
            {row.order.number}
          </Link>
        </p>
      ) : (
        manage &&
        can("order.create") && (
          <Link
            className="btn small"
            to={"/orders/new?wholesale=" + row.id}
            onClick={onClose}
          >
            Створити замовлення
          </Link>
        )
      )}
      <section aria-label="Коментарі">
        <h3>Коментарі</h3>
        {detail.isPending ? (
          <Loading rows={2} />
        ) : detail.isError ? (
          <ErrorBox
            error={detail.error}
            onRetry={() => void detail.refetch()}
          />
        ) : notes.length ? (
          <ul className="stack">
            {notes.map((n) => (
              <li key={n.id}>
                {n.body}
                <small className="cell-sub">
                  {(n.author ?? "—") + " · " + date(n.created_at)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Коментарів ще немає.</p>
        )}
        {manage && (
          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              Новий коментар
              <textarea
                maxLength={4000}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn small"
              disabled={busy || !comment.trim()}
              onClick={() => void addComment()}
            >
              Додати коментар
            </button>
          </div>
        )}
      </section>
    </ActionDialog>
  );
}

export function CustomerCard() {
  const { id = "" } = useParams();
  const can = useCan();
  const client = useQueryClient();
  const { notify } = useWorkspace();
  const q = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api<CustomerDetail>("/customers/" + encodeURIComponent(id)),
  });
  const [phone, setPhone] = useState<string | null>(null),
    [rename, setRename] = useState(false),
    [first, setFirst] = useState(""),
    [last, setLast] = useState("");
  if (q.isPending) return <Loading rows={5} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const c = q.data.customer as {
    id: string;
    name: string;
    email: string;
    phone_masked: string | null;
    phone_verified: boolean;
    source: string;
    created_at?: string;
  };
  const reveal = async () => {
    try {
      setPhone(
        (
          await api<{ phone: string | null }>(
            `/customers/${encodeURIComponent(id)}/phone`,
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
      <Link className="btn ghost small" to="/customers">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.customers}
      </Link>
      <PageHead
        title={c.name || c.email || "Клієнт"}
        text={
          c.source === "ACCOUNT"
            ? "Кабінет покупця"
            : "Контакт гостьового замовлення"
        }
        actions={
          can("customer.edit") && c.source === "ACCOUNT" ? (
            <button className="btn" onClick={() => setRename(true)}>
              Змінити ім’я
            </button>
          ) : undefined
        }
      />
      <div className="grid-2">
        <Panel title="Замовлення">
          {(q.data.orders as Order[]).length ? (
            (q.data.orders as Order[]).map((o) => (
              <Link key={o.id} className="mcard" to={"/orders/" + o.id}>
                <div className="mcard-top">
                  <strong>{o.number}</strong>
                  <span className="num">{money(o.total_minor)}</span>
                </div>
                <span className="sub">{date(o.created_at, true)}</span>
                <Status3 display={o.display} />
              </Link>
            ))
          ) : (
            <Empty title="Замовлень немає" text="" />
          )}
        </Panel>
        <Panel title="Контакти">
          <dl className="panel-body dl">
            <dt>Телефон</dt>
            <dd>
              {phone ? (
                <a className="link" href={telHref(phone)}>
                  <Phone size={14} aria-hidden="true" /> {phone}
                </a>
              ) : (
                <>
                  {c.phone_masked ?? "—"}{" "}
                  {can("customer.phone.full") && c.phone_masked && (
                    <button
                      className="btn small ghost"
                      onClick={() => void reveal()}
                    >
                      Показати
                    </button>
                  )}
                </>
              )}
              {c.phone_verified && (
                <small className="cell-sub">підтверджений через SMS</small>
              )}
            </dd>
            <dt>Email</dt>
            <dd>{c.email || "—"}</dd>
          </dl>
        </Panel>
      </div>
      {rename && (
        <ActionDialog
          title="Змінити ім’я клієнта"
          needReason
          onClose={() => setRename(false)}
          onSubmit={async ({ key, reason }) => {
            await api(
              `/customers/${encodeURIComponent(id)}/profile`,
              { first_name: first.trim(), last_name: last.trim(), reason },
              { idem: key },
            );
            void client.invalidateQueries({ queryKey: ["customer", id] });
          }}
        >
          <label className="field">
            Ім’я
            <input
              required
              maxLength={80}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </label>
          <label className="field">
            Прізвище
            <input
              maxLength={80}
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </label>
        </ActionDialog>
      )}
    </>
  );
}

type Ship = {
  id: number;
  order_id: number;
  order_number: string;
  supplier_name: string;
  status: string;
  tracking_number: string | null;
  updated_at: string;
};
export function Delivery() {
  const { notify } = useWorkspace();
  const [sp, setSp] = useSearchParams();
  const [text, setText] = useState("");
  const q = useDebounce(text);
  const state = sp.get("state") ?? "";
  const query = { q, state, page: sp.get("page") ?? "1", limit: "25" };
  const list = useQuery({
    queryKey: ["shipments", query],
    queryFn: () => api<ShipmentList>("/shipments" + params(query)),
    refetchInterval: 60_000,
    placeholderData: (p) => p,
  });
  const columns: Column<Ship>[] = [
    {
      key: "ttn",
      title: "ТТН",
      render: (s) =>
        s.tracking_number ? (
          <span className="row">
            <Link className="link" to={"/delivery/" + s.id}>
              {s.tracking_number}
            </Link>
            <button
              className="icon-btn"
              aria-label={"Скопіювати ТТН " + s.tracking_number}
              onClick={async () =>
                notify(
                  (await copy(s.tracking_number!)) ? t.copied : t.copyFailed,
                )
              }
            >
              <Copy size={14} />
            </button>
          </span>
        ) : (
          <Link className="link" to={"/delivery/" + s.id}>
            Чернетка № {s.id}
          </Link>
        ),
    },
    {
      key: "order",
      title: "Замовлення",
      render: (s) => (
        <Link className="link" to={"/orders/" + s.order_id}>
          {s.order_number}
        </Link>
      ),
    },
    { key: "supplier", title: "Постачальник", render: (s) => s.supplier_name },
    {
      key: "status",
      title: "Статус",
      render: (s) => <Pill code={s.status}>{label(t.shipment, s.status)}</Pill>,
    },
    {
      key: "updated",
      title: "Оновлено",
      render: (s) => date(s.updated_at, true),
    },
  ];
  return (
    <>
      <PageHead
        title={t.nav.delivery}
        text="Статуси доставки — лише від Нової пошти. Відправник кожної посилки — профіль постачальника."
      />
      <Panel>
        <Tabs
          items={[
            ["", "Усі"],
            ["draft", "Чернетки"],
            ["created", "ТТН створено"],
            ["sent", "Відправлено"],
            ["delivered", "Доставлено"],
            ["unknown", "Потребують розбору"],
            ["returned", "Повернення"],
          ]}
          value={state}
          onChange={(v) => setSp(v ? { state: v } : {})}
        />
        <div className="toolbar">
          <SearchBox
            value={text}
            onChange={setText}
            placeholder="ТТН або номер замовлення"
          />
        </div>
        {list.isPending ? (
          <Loading rows={5} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty title="Відправлень немає" text="" />
        ) : (
          <>
            <DataView
              rows={list.data.rows as Ship[]}
              columns={columns}
              rowKey={(s) => s.id}
              card={(s) => (
                <div className="mcard">
                  <div className="mcard-top">
                    <Link className="link" to={"/delivery/" + s.id}>
                      <strong>
                        {s.tracking_number ?? "Чернетка № " + s.id}
                      </strong>
                    </Link>
                    <Pill code={s.status}>{label(t.shipment, s.status)}</Pill>
                  </div>
                  <span className="sub">
                    {s.order_number} · {s.supplier_name}
                  </span>
                  {s.tracking_number && (
                    <button
                      className="btn"
                      onClick={async () =>
                        notify(
                          (await copy(s.tracking_number!))
                            ? t.copied
                            : t.copyFailed,
                        )
                      }
                    >
                      <Copy size={16} aria-hidden="true" /> Скопіювати ТТН
                    </button>
                  )}
                </div>
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

export function ShipmentCard() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["shipment", Number(id)],
    queryFn: () => api<ShipmentDetail>("/shipments/" + id),
  });
  if (q.isPending) return <Loading rows={4} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const s = q.data.record as {
    id: number;
    status: string;
    tracking_number: string | null;
    supplier_code: string;
    origin_label: string;
    created_at: string;
    error: string;
  };
  const o = q.data.order as Order;
  return (
    <>
      <Link className="btn ghost small" to="/delivery">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.delivery}
      </Link>
      <PageHead
        title={
          s.tracking_number
            ? "ТТН " + s.tracking_number
            : "Чернетка посилки № " + s.id
        }
        text={s.origin_label || s.supplier_code}
        actions={
          <Link className="btn primary" to={"/orders/" + o.id}>
            Дії — у картці замовлення
          </Link>
        }
      />
      <Panel title="Стан">
        <div className="panel-body stack">
          <Pill code={s.status}>{label(t.shipment, s.status)}</Pill>
          {s.error && <Note tone="bad">{s.error}</Note>}
          <span>
            Замовлення{" "}
            <Link className="link" to={"/orders/" + o.id}>
              {o.number}
            </Link>
          </span>
          <Status3 display={o.display} captions />
        </div>
      </Panel>
    </>
  );
}
