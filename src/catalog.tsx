import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type {
  ProductDetail,
  ProductList,
  SupplierDetail,
  SupplierList,
} from "./contract.gen";
import { api, date, money, params, useCan } from "./lib";
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
  Tabs,
  useDebounce,
} from "./kit";
import { t } from "./i18n";

type Prod = {
  id: string;
  name: string;
  brand: string;
  category_path: string;
  visible: number;
  skus: number;
  colors: number;
  in_stock: number;
  price_minor: number | null;
  sold_qty: number;
};
/** Products are PIM's: read-only here (M-5); changes are made in PIM. */
export function Products() {
  const [sp, setSp] = useSearchParams();
  const [text, setText] = useState("");
  const q = useDebounce(text);
  const published = sp.get("published") ?? "";
  const query = {
    q,
    published,
    page: sp.get("page") ?? "1",
    limit: "25",
    period: "30d",
  };
  const list = useQuery({
    queryKey: ["products", query],
    queryFn: () => api<ProductList>("/products" + params(query)),
    placeholderData: (p) => p,
  });
  const columns: Column<Prod>[] = [
    {
      key: "name",
      title: "Модель",
      render: (p) => (
        <>
          <Link className="link" to={"/products/" + encodeURIComponent(p.id)}>
            {p.name}
          </Link>
          <small>
            {p.brand} · {p.category_path}
          </small>
        </>
      ),
    },
    {
      key: "variants",
      title: "Кольори / SKU",
      render: (p) => `${p.colors} / ${p.skus}`,
    },
    {
      key: "price",
      title: "Ціна від",
      className: "right",
      render: (p) => <span className="num">{money(p.price_minor)}</span>,
    },
    {
      key: "stock",
      title: "Наявність",
      render: (p) =>
        p.in_stock ? (
          <Pill code="PAID">є: {p.in_stock} SKU</Pill>
        ) : (
          <Pill code="AWAITING">не підтверджено</Pill>
        ),
    },
    {
      key: "pub",
      title: "Публікація",
      render: (p) =>
        p.visible ? (
          <Pill code="PAID">опубліковано</Pill>
        ) : (
          <Pill code="">приховано</Pill>
        ),
    },
    {
      key: "sold",
      title: "Продано за 30 днів",
      className: "right",
      render: (p) => p.sold_qty,
    },
  ];
  return (
    <>
      <PageHead
        title={t.nav.products}
        text="Дані PIM (лише читання): моделі, кольори, розміри, SKU, ціни, наявність. Змінюються в PIM."
      />
      <Panel>
        <Tabs
          items={[
            ["", "Усі"],
            ["1", "Опубліковані"],
            ["0", "Приховані"],
          ]}
          value={published}
          onChange={(v) => setSp(v ? { published: v } : {})}
        />
        <div className="toolbar">
          <SearchBox
            value={text}
            onChange={setText}
            placeholder="Назва, модель або SKU"
          />
        </div>
        {list.isPending ? (
          <Loading rows={5} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty />
        ) : (
          <>
            <DataView
              rows={list.data.rows as Prod[]}
              columns={columns}
              rowKey={(p) => p.id}
              card={(p) => (
                <Link
                  className="mcard"
                  to={"/products/" + encodeURIComponent(p.id)}
                >
                  <div className="mcard-top">
                    <strong>{p.name}</strong>
                    <span className="num">{money(p.price_minor)}</span>
                  </div>
                  <span className="sub">
                    {p.colors} кол. · {p.skus} SKU ·{" "}
                    {p.in_stock ? "є в наявності" : "наявність не підтверджено"}
                  </span>
                </Link>
              )}
            />
            <Pager
              page={list.data.pagination}
              onChange={(n) =>
                setSp({ ...(published ? { published } : {}), page: String(n) })
              }
            />
          </>
        )}
      </Panel>
    </>
  );
}

type Variant = {
  sku: string;
  color: string;
  pim_size_display: string | null;
  availability: string;
  stock_label: string;
  price_minor: number | null;
  kit_price_minor: number | null;
  lead_days: number | null;
};
export function ProductCard() {
  const { id = "" } = useParams();
  const q = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>("/products/" + encodeURIComponent(id)),
  });
  if (q.isPending) return <Loading rows={5} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data.product as {
    name: string;
    brand: string;
    category_path: string;
    visible: number;
    photo: string | null;
  };
  const columns: Column<Variant>[] = [
    {
      key: "sku",
      title: "SKU",
      render: (v) => <span className="num">{v.sku}</span>,
    },
    { key: "color", title: "Колір", render: (v) => v.color || "—" },
    { key: "size", title: "Розмір", render: (v) => v.pim_size_display || "—" },
    {
      key: "price",
      title: "Ціна / комплект",
      className: "right",
      render: (v) => (
        <span className="num">
          {money(v.price_minor)}
          {v.kit_price_minor ? " / " + money(v.kit_price_minor) : ""}
        </span>
      ),
    },
    {
      key: "stock",
      title: "Наявність",
      render: (v) => (
        <>
          <Pill
            code={
              v.availability === "IN_STOCK"
                ? "PAID"
                : v.availability === "OUT_OF_STOCK"
                  ? "FAILED"
                  : "AWAITING"
            }
          >
            {v.availability}
          </Pill>
          <small>залишок: {v.stock_label}</small>
        </>
      ),
    },
  ];
  return (
    <>
      <Link className="btn ghost small" to="/products">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.products}
      </Link>
      <PageHead
        title={p.name}
        text={`${p.brand} · ${p.category_path} · ${p.visible ? "опубліковано" : "приховано"}`}
        actions={
          q.data.pim_url ? (
            <a
              className="btn"
              href={q.data.pim_url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink size={16} aria-hidden="true" /> Відкрити в PIM
            </a>
          ) : undefined
        }
      />
      <Panel title="Варіанти">
        <DataView
          rows={q.data.variants as Variant[]}
          columns={columns}
          rowKey={(v) => v.sku}
          card={(v) => (
            <div className="mcard">
              <div className="mcard-top">
                <strong>{v.sku}</strong>
                <span className="num">{money(v.price_minor)}</span>
              </div>
              <span className="sub">
                {v.color} · {v.pim_size_display} · залишок {v.stock_label}
              </span>
            </div>
          )}
        />
      </Panel>
    </>
  );
}

type Sup = {
  code: string;
  name: string;
  city: string;
  branch: string;
  sender_confirmed: boolean;
  contact_person: string | null;
  prep_days: number | null;
  phone_masked: string | null;
  products: number;
  orders: number;
  refusal_share: number;
  prep_hours: number | null;
  delayed: number;
};
export function Suppliers() {
  const list = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<SupplierList>("/suppliers"),
  });
  const columns: Column<Sup>[] = [
    {
      key: "name",
      title: "Постачальник",
      render: (s) => (
        <>
          <Link className="link" to={"/suppliers/" + s.code}>
            {s.name}
          </Link>
          <small>{s.contact_person || "контакт не вказано"}</small>
        </>
      ),
    },
    {
      key: "point",
      title: "Точка відправки НП",
      render: (s) => (
        <>
          {s.city} · відд. {s.branch}
          <small>
            {s.sender_confirmed
              ? "профіль підтверджено"
              : "профіль не підтверджено"}
          </small>
        </>
      ),
    },
    {
      key: "products",
      title: "Товарів",
      className: "right",
      render: (s) => s.products,
    },
    {
      key: "orders",
      title: "Замовлень (30 дн.)",
      className: "right",
      render: (s) => s.orders,
    },
    {
      key: "prep",
      title: "Підготовка",
      render: (s) =>
        s.prep_hours !== null
          ? `${s.prep_hours} год`
          : s.prep_days !== null
            ? `${s.prep_days} дн. (план)`
            : "—",
    },
    {
      key: "refusal",
      title: "Відмови",
      className: "right",
      render: (s) => `${Math.round(s.refusal_share * 100)}%`,
    },
    {
      key: "delayed",
      title: "Затримки",
      className: "right",
      render: (s) => (s.delayed ? <Pill code="FAILED">{s.delayed}</Pill> : "0"),
    },
  ];
  return (
    <>
      <PageHead
        title={t.nav.suppliers}
        text="Список і товари — з PIM; точки відправки — профілі відправника (єдине джерело для ТТН)."
      />
      <Panel>
        {list.isPending ? (
          <Loading rows={5} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty />
        ) : (
          <DataView
            rows={list.data.rows as Sup[]}
            columns={columns}
            rowKey={(s) => s.code}
            card={(s) => (
              <Link className="mcard" to={"/suppliers/" + s.code}>
                <div className="mcard-top">
                  <strong>{s.name}</strong>
                  {s.sender_confirmed ? (
                    <Pill code="PAID">готовий до ТТН</Pill>
                  ) : (
                    <Pill code="AWAITING">профіль не підтверджено</Pill>
                  )}
                </div>
                <span className="sub">
                  {s.city} · {s.orders} замовл. · відмови{" "}
                  {Math.round(s.refusal_share * 100)}%
                </span>
              </Link>
            )}
          />
        )}
      </Panel>
    </>
  );
}

type Sender = {
  code: string;
  name: string;
  city: string;
  region: string;
  branch: string;
  cargo_branch: string;
  city_ref: string;
  warehouse_ref: string;
  cargo_warehouse_ref: string;
  sender_ref: string;
  contact_ref: string;
  phone: string;
  confirmed: number;
  version: number;
  complete: boolean;
  contact_person?: string;
  prep_days?: number | null;
  updated_at: string;
};
export function SupplierCard() {
  const { code = "" } = useParams();
  const can = useCan();
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["supplier", code],
    queryFn: () => api<SupplierDetail>("/suppliers/" + code),
  });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Partial<Sender>>({});
  if (q.isPending) return <Loading rows={5} />;
  if (q.isError)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const s = q.data.supplier as { name: string; city: string };
  const sender = q.data.sender as Sender | null;
  const fields: [keyof Sender, string][] = [
    ["name", "Назва складу"],
    ["city", "Місто"],
    ["region", "Область"],
    ["branch", "Відділення"],
    ["cargo_branch", "Вантажне відділення"],
    ["city_ref", "Ref міста НП"],
    ["warehouse_ref", "Ref відділення НП"],
    ["cargo_warehouse_ref", "Ref вантажного відділення"],
    ["sender_ref", "Ref відправника"],
    ["contact_ref", "Ref контакту"],
    ["phone", "Телефон відправника"],
    ["contact_person", "Контактна особа"],
  ];
  return (
    <>
      <Link className="btn ghost small" to="/suppliers">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.suppliers}
      </Link>
      <PageHead
        title={s.name}
        text="Профіль відправника — єдине джерело точки відправки та відправника для ТТН (LOG-04)."
        actions={
          can("supplier.manage") && sender ? (
            <button
              className="btn"
              onClick={() => {
                setForm(sender);
                setEdit(true);
              }}
            >
              Змінити профіль
            </button>
          ) : undefined
        }
      />
      <div className="grid-2">
        <Panel title="Профіль відправника">
          {sender ? (
            <dl className="panel-body dl">
              <dt>Готовність</dt>
              <dd>
                {sender.complete ? (
                  <Pill code="PAID">готовий до ТТН</Pill>
                ) : (
                  <Pill code="AWAITING">потребує підтверджених даних НП</Pill>
                )}
              </dd>
              <dt>Точка</dt>
              <dd>
                {sender.city}, {sender.region} · відд. {sender.branch}
                {sender.cargo_branch
                  ? ` · вантажне ${sender.cargo_branch}`
                  : ""}
              </dd>
              <dt>Контакт</dt>
              <dd>{sender.contact_person || "—"}</dd>
              <dt>Строк підготовки</dt>
              <dd>
                {sender.prep_days !== null && sender.prep_days !== undefined
                  ? `${sender.prep_days} дн.`
                  : "—"}
              </dd>
              <dt>Оновлено</dt>
              <dd>{date(sender.updated_at, true)}</dd>
            </dl>
          ) : (
            <Empty title="Профілю немає" text="" />
          )}
        </Panel>
        <Panel title="Останні замовлення">
          {(
            (q.data.orders ?? []) as {
              id: number;
              order_number: string;
              status: string;
              created_at: string;
            }[]
          ).map((o) => (
            <Link key={o.id} className="mcard" to={"/orders/" + o.id}>
              <div className="mcard-top">
                <strong>{o.order_number}</strong>
                <span className="muted">{date(o.created_at)}</span>
              </div>
            </Link>
          ))}
          {!(q.data.orders ?? []).length && (
            <Empty title="Замовлень немає" text="" />
          )}
        </Panel>
      </div>
      {edit && sender && (
        <ActionDialog
          wide
          title="Профіль відправника"
          needReason
          onClose={() => setEdit(false)}
          onStale={() => q.refetch()}
          onSubmit={async ({ key, reason }) => {
            await api(
              `/suppliers/${code}/sender`,
              {
                version: sender.version,
                reason,
                ...Object.fromEntries(
                  fields.map(([k]) => [k, String(form[k] ?? "")]),
                ),
                confirmed: !!form.confirmed,
                ...(form.prep_days !== undefined && form.prep_days !== null
                  ? { prep_days: Number(form.prep_days) }
                  : {}),
              },
              { idem: key },
            );
            void client.invalidateQueries({ queryKey: ["supplier", code] });
          }}
        >
          <Note tone="info">
            Зміна потребує повторного входу. Підтверджений профіль має містити
            refs Нової пошти та телефон.
          </Note>
          <div className="grid-even">
            {fields.map(([k, name]) => (
              <label className="field" key={k}>
                {name}
                <input
                  value={String(form[k] ?? "")}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <label className="field">
            Строк підготовки, днів
            <input
              type="number"
              min="0"
              max="60"
              value={form.prep_days ?? ""}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  prep_days:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!form.confirmed}
              onChange={(e) =>
                setForm((v) => ({ ...v, confirmed: e.target.checked ? 1 : 0 }))
              }
            />{" "}
            Дані перевірено в кабінеті НП
          </label>
        </ActionDialog>
      )}
    </>
  );
}
