import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, Download, Plus, Save, UserPlus, X } from "lucide-react";
import type {
  AssigneeList,
  OrderList,
  OrderSummary,
  SavedViewList,
  SupplierList,
} from "./contract.gen";
import {
  api,
  date,
  download,
  money,
  params,
  time,
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
  Pager,
  PageHead,
  Panel,
  SearchBox,
  Status3,
  Tabs,
  useDebounce,
} from "./kit";
import { t } from "./i18n";

const TABS = [
  "all",
  "new",
  "confirmation",
  "payment",
  "processing",
  "delivery",
  "completed",
  "cancelled",
  "problem",
  "mine",
] as const;
const ALL_COLUMNS = [
  "number",
  "customer",
  "items",
  "total",
  "status",
  "manager",
  "supplier",
  "channel",
] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number];
const readColumns = (): ColumnKey[] => {
  try {
    const v = JSON.parse(localStorage.getItem("crm.order.columns") ?? "null");
    return Array.isArray(v) && v.length ? v : [...ALL_COLUMNS];
  } catch {
    return [...ALL_COLUMNS];
  }
};

export function Orders() {
  const can = useCan();
  const { notify } = useWorkspace();
  const client = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [text, setText] = useState(sp.get("q") ?? "");
  const q = useDebounce(text);
  const view = sp.get("view") ?? "all";
  const set = (patch: Record<string, string | null>) =>
    setSp((p) => {
      for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k);
      if (!("page" in patch)) p.delete("page");
      return p;
    });
  useEffect(() => {
    if ((sp.get("q") ?? "") !== q) set({ q: q || null });
  }, [q]);
  const query = Object.fromEntries(sp);
  const list = useQuery({
    queryKey: ["orders", query],
    queryFn: ({ signal }) =>
      api<OrderList>("/orders" + params({ limit: 25, ...query }), undefined, {
        signal,
      }),
    refetchInterval: 45_000, // new orders appear without reload (ТЗ 7.1: poll 30–60 s and on tab return)
    placeholderData: (prev) => prev,
  });
  const counters = useQuery({
    queryKey: ["counters"],
    queryFn: () => api<{ tabs: Record<string, number> }>("/orders/counters"),
    refetchInterval: 45_000,
  });
  const seen = useRef<number | null>(null);
  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    const total = counters.data?.tabs.all;
    if (total === undefined) return;
    if (seen.current !== null && total > seen.current)
      setFresh(total - seen.current);
    if (seen.current === null) seen.current = total;
  }, [counters.data?.tabs.all]);
  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => api<AssigneeList>("/staff/assignees"),
    enabled: can("staff.assignees"),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<SupplierList>("/suppliers"),
    enabled: can("supplier.view"),
  });
  const views = useQuery({
    queryKey: ["views"],
    queryFn: () => api<SavedViewList>("/views"),
  });
  const [columns, setColumns] = useState<ColumnKey[]>(readColumns);
  const [picker, setPicker] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  useEffect(() => {
    try {
      localStorage.setItem("crm.order.columns", JSON.stringify(columns));
    } catch {
      /* UI preference only */
    }
  }, [columns]);
  const sort = sp.get("sort") ?? "date",
    dir = sp.get("direction") ?? "desc";
  const onSort = (k: string) =>
    set({ sort: k, direction: sort === k && dir === "desc" ? "asc" : "desc" });
  const all: Column<OrderSummary>[] = useMemo(
    () => [
      {
        key: "number",
        title: "Замовлення",
        sort: "number",
        render: (o) => (
          <>
            <Link className="link" to={"/orders/" + o.id}>
              {o.number}
            </Link>
            <small>
              {date(o.created_at)} · {time(o.created_at)}
            </small>
          </>
        ),
      },
      {
        key: "customer",
        title: "Клієнт",
        render: (o) => (
          <>
            <span>{String(o.customer.name || o.customer.email || "—")}</span>
            <small>{String(o.customer.phone_masked ?? "")}</small>
          </>
        ),
      },
      {
        key: "items",
        title: "Товари",
        render: (o) => <span className="nowrap">{o.items.length} поз.</span>,
      },
      {
        key: "total",
        title: "Сума",
        sort: "total",
        className: "right",
        render: (o) => (
          <strong className="num nowrap">{money(o.total_minor)}</strong>
        ),
      },
      {
        key: "status",
        title: "Замовлення · Оплата · Доставка",
        render: (o) => <Status3 display={o.display} />,
      },
      {
        key: "manager",
        title: "Менеджер",
        render: (o) => (
          <span>
            {(o.assigned_manager as { name?: string } | null)?.name ?? (
              <span className="muted">Не призначено</span>
            )}
          </span>
        ),
      },
      {
        key: "supplier",
        title: "Постачальник",
        render: (o) => (
          <span className="sub">
            {Array.from(
              new Set(
                ((o as { lines?: { supplier_name: string }[] }).lines ?? [])
                  .map((l) => l.supplier_name)
                  .filter(Boolean),
              ),
            ).join(", ") || "—"}
          </span>
        ),
      },
      {
        key: "channel",
        title: "Канал",
        render: (o) => (
          <span className="sub">
            {t.channel[o.channel ?? "web"] ?? o.channel}
          </span>
        ),
      },
    ],
    [],
  );
  const shown = all.filter((c) => columns.includes(c.key as ColumnKey));
  const card = (o: OrderSummary) => (
    <div className="mcard">
      <div className="mcard-top">
        <Link className="link" to={"/orders/" + o.id}>
          <strong>{o.number}</strong>
        </Link>
        <strong className="num">{money(o.total_minor)}</strong>
      </div>
      <div className="sub">
        {String(o.customer.name || "—")} · {date(o.created_at, true)}
      </div>
      <Status3 display={o.display} />
      {o.primary_action && (
        <Link
          className="btn primary"
          to={`/orders/${o.id}?do=${o.primary_action}`}
        >
          {t.actions[o.primary_action]}
        </Link>
      )}
    </div>
  );
  return (
    <>
      <PageHead
        title={t.nav.orders}
        text="Від першого звернення до отримання посилки."
        actions={
          <>
            {can("order.create") && (
              <Link className="btn primary" to="/orders/new">
                <Plus size={16} aria-hidden="true" /> Створити замовлення
              </Link>
            )}
            <button className="btn" onClick={() => setSaveOpen(true)}>
              <Save size={16} aria-hidden="true" /> Зберегти подання
            </button>
          </>
        }
      />
      {(views.data?.rows.length ?? 0) > 0 && (
        <div className="row" aria-label="Збережені подання">
          {views.data!.rows.map((v) => (
            <span className="pill" key={v.id}>
              <button
                className="btn ghost small"
                onClick={() => {
                  setSp(new URLSearchParams(v.query));
                  setText(new URLSearchParams(v.query).get("q") ?? "");
                }}
              >
                {v.name}
              </button>
              <button
                className="icon-btn"
                aria-label={"Видалити подання " + v.name}
                onClick={async () => {
                  await api(`/views/${v.id}/delete`, {});
                  void client.invalidateQueries({ queryKey: ["views"] });
                }}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      {fresh > 0 && (
        <button
          className="note-box info btn"
          onClick={() => {
            seen.current = counters.data?.tabs.all ?? null;
            setFresh(0);
            void list.refetch();
          }}
        >
          Нових замовлень: {fresh}. Показати
        </button>
      )}
      <Panel>
        <Tabs
          items={TABS.filter(
            (k) => k !== "payment" || can("order.finance.view"),
          ).map((k) => [k, t.tabs[k]] as [string, string])}
          value={view}
          onChange={(v) => {
            set({ view: v === "all" ? null : v });
            setSelected(new Set());
          }}
          counts={counters.data?.tabs}
        />
        <div className="toolbar">
          <SearchBox
            value={text}
            onChange={setText}
            placeholder="Номер, ім’я, телефон, email або ТТН"
          />
          {can("staff.assignees") && (
            <select
              aria-label="Менеджер"
              value={sp.get("manager") ?? ""}
              onChange={(e) => set({ manager: e.target.value || null })}
            >
              <option value="">Усі менеджери</option>
              {(
                assignees.data?.rows as
                  | { id: string; name: string }[]
                  | undefined
              )?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          {can("supplier.view") && (
            <select
              aria-label="Постачальник"
              value={sp.get("supplier") ?? ""}
              onChange={(e) => set({ supplier: e.target.value || null })}
            >
              <option value="">Усі постачальники</option>
              {(
                suppliers.data?.rows as
                  | { code: string; name: string }[]
                  | undefined
              )?.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Потребує уваги"
            value={sp.get("attention") ?? ""}
            onChange={(e) => set({ attention: e.target.value || null })}
          >
            <option value="">Увага: усі</option>
            <option value="confirmation">Чекають підтвердження</option>
            {can("order.finance.view") && (
              <option value="payment_review">Оплата потребує перевірки</option>
            )}
            <option value="delivery_review">Посилка потребує розбору</option>
            <option value="ready_to_ship">Готові до відправки</option>
            <option value="no_supplier">Без постачальника</option>
            <option value="problem">Позначені проблемні</option>
          </select>
          <select
            aria-label="Канал"
            value={sp.get("channel") ?? ""}
            onChange={(e) => set({ channel: e.target.value || null })}
          >
            <option value="">Усі канали</option>
            {Object.entries(t.channel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <div className="anchor desktop-only">
            <button
              className="btn"
              aria-expanded={picker}
              onClick={() => setPicker((v) => !v)}
            >
              <Columns3 size={16} aria-hidden="true" /> Колонки
            </button>
            {picker && (
              <div
                className="popover panel-body stack"
                role="group"
                aria-label="Колонки таблиці"
              >
                {all.map((c) => (
                  <label className="check" key={c.key}>
                    <input
                      type="checkbox"
                      checked={columns.includes(c.key as ColumnKey)}
                      disabled={c.key === "number"}
                      onChange={() =>
                        setColumns((v) =>
                          v.includes(c.key as ColumnKey)
                            ? v.filter((x) => x !== c.key)
                            : [...v, c.key as ColumnKey],
                        )
                      }
                    />
                    {c.title}
                  </label>
                ))}
              </div>
            )}
          </div>
          {can("export.orders") && (
            <button
              className="btn"
              onClick={() =>
                download("/orders/export" + params(query)).catch((e) =>
                  notify(e.message, "error"),
                )
              }
            >
              <Download size={16} aria-hidden="true" /> Експорт
            </button>
          )}
        </div>
        {selected.size > 0 && can("order.assign.any") && (
          <div className="toolbar">
            <strong>Обрано: {selected.size}</strong>
            <button className="btn" onClick={() => setBulk(true)}>
              <UserPlus size={16} aria-hidden="true" /> Призначити
            </button>
            <button
              className="btn ghost"
              onClick={() => setSelected(new Set())}
            >
              Зняти вибір
            </button>
          </div>
        )}
        {list.isPending ? (
          <Loading rows={6} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty
            title="Замовлень не знайдено"
            text="Змініть вкладку, пошук або фільтри."
          />
        ) : (
          <>
            <DataView
              rows={list.data.rows}
              columns={shown}
              card={card}
              rowKey={(o) => o.id}
              sort={(dir === "desc" ? "-" : "") + sort}
              onSort={onSort}
              selectable={can("order.assign.any")}
              selected={selected}
              onSelect={setSelected}
            />
            <Pager
              page={list.data.pagination}
              onChange={(p) => set({ page: String(p) })}
            />
          </>
        )}
      </Panel>
      {saveOpen && (
        <SaveView query={sp.toString()} onClose={() => setSaveOpen(false)} />
      )}
      {bulk && list.data && (
        <BulkAssign
          rows={list.data.rows.filter((o) => selected.has(o.id))}
          onClose={() => setBulk(false)}
          onDone={(n) => {
            setSelected(new Set());
            notify(`Призначено: ${n}`);
            void client.invalidateQueries({ queryKey: ["orders"] });
          }}
        />
      )}
    </>
  );
}

function SaveView({ query, onClose }: { query: string; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  return (
    <ActionDialog
      title="Зберегти подання"
      onClose={onClose}
      submitText={t.save}
      onSubmit={async ({ key }) => {
        await api(
          "/views",
          { name: name.trim(), query, scope: "orders" },
          { idem: key },
        );
        void client.invalidateQueries({ queryKey: ["views"] });
      }}
    >
      <label className="field">
        Назва
        <input
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-autofocus
        />
      </label>
      <p className="muted">
        Подання зберігає вкладку, пошук і фільтри. Бачите його лише ви.
      </p>
    </ActionDialog>
  );
}

function BulkAssign({
  rows,
  onClose,
  onDone,
}: {
  rows: OrderSummary[];
  onClose: () => void;
  onDone: (n: number) => void;
}) {
  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => api<AssigneeList>("/staff/assignees"),
  });
  const [staff, setStaff] = useState("");
  const [result, setResult] = useState<
    { id: number; ok: boolean; code?: string }[] | null
  >(null);
  const others = rows.some((o) => o.assigned_manager);
  return (
    <ActionDialog
      title={`Призначити ${rows.length} замовлень`}
      onClose={onClose}
      needReason={others}
      onSubmit={async ({ key, reason }) => {
        const r = await api<{
          results: { id: number; ok: boolean; code?: string }[];
        }>(
          "/orders/bulk/assign",
          {
            ids: rows.map((o) => o.id),
            versions: Object.fromEntries(rows.map((o) => [o.id, o.version])),
            staff_id: staff || null,
            ...(reason ? { reason } : {}),
          },
          { idem: key },
        );
        setResult(r.results);
        onDone(r.results.filter((x) => x.ok).length);
      }}
    >
      <label className="field">
        Менеджер
        <select
          required
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
        >
          <option value="">Оберіть</option>
          {(
            assignees.data?.rows as { id: string; name: string }[] | undefined
          )?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {others && (
        <p className="muted">
          Деякі замовлення вже мають менеджера — вкажіть причину переназначення.
        </p>
      )}
      {result && (
        <p>
          {result.filter((r) => !r.ok).length
            ? `Не вдалося: ${result.filter((r) => !r.ok).length} (замовлення змінилися)`
            : t.done}
        </p>
      )}
    </ActionDialog>
  );
}
