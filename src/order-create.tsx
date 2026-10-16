import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type {
  CustomerList,
  Order,
  ProductDetail,
  ProductList,
  WholesaleDetail,
} from "./contract.gen";
import {
  api,
  ApiError,
  money,
  params,
  useAttemptKey,
  useWorkspace,
} from "./lib";
import { Note, PageHead, Panel, SearchBox, useDebounce } from "./kit";
import { t } from "./i18n";

type Variant = {
  sku: string;
  pim_color_id: string | null;
  color: string;
  pim_size_display: string | null;
  availability: string;
  price_minor: number | null;
};
type Line = {
  product_id: string;
  name: string;
  color_id: string | null;
  sku: string;
  label: string;
  qty: number;
  price_minor: number | null;
};
const normalizePhone = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (/^0\d{9}$/.test(d)) d = "38" + d;
  return /^380\d{9}$/.test(d) ? "+" + d : null;
};

/** A new mode (phone order / order from another wholesale request) starts with a clean form. */
export function OrderCreate() {
  const [sp] = useSearchParams();
  return <OrderCreateForm key={sp.get("wholesale") ?? "phone"} />;
}

/** Telephone order (ТЗ 7.3): the server prices it with the same service as the website; no manual discount or delivery fee. */
function OrderCreateForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notify } = useWorkspace();
  const attempt = useAttemptKey();
  // OD-4.6: «?wholesale=<id>» — an order made from a wholesale request; the buyer and the phone come from the request.
  const [sp] = useSearchParams();
  const wsId = sp.get("wholesale");
  const ws = useQuery({
    queryKey: ["wholesale", "detail", wsId],
    queryFn: () => api<WholesaleDetail>("/wholesale/" + wsId),
    enabled: !!wsId,
  });
  const wsReq = ws.data?.request as
    | {
        number: string;
        name: string;
        phone_masked: string | null;
        email: string;
      }
    | undefined;
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [recipient, setRecipient] = useState("");
  const [channel, setChannel] = useState("phone"),
    [payment, setPayment] = useState<"card" | "invoice">(
      wsId ? "invoice" : "card",
    ),
    [promo, setPromo] = useState(""),
    [comment, setComment] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [city, setCity] = useState(""),
    [cityRef, setCityRef] = useState(""),
    [type, setType] = useState<"branch" | "postomat">("branch"),
    [point, setPoint] = useState("");
  const [quote, setQuote] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const normalized = normalizePhone(phone);
  const dupes = useQuery({
    queryKey: ["dupes", normalized],
    queryFn: () =>
      api<CustomerList>(
        "/customers" + params({ q: normalized ?? "", limit: 5 }),
      ),
    enabled: !!normalized,
  });
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
  const changed = () => setQuote(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        customer: {
          name: name.trim(),
          phone: normalized ?? phone,
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(recipient.trim() ? { recipient: recipient.trim() } : {}),
        },
        lines: lines.map((l) => ({
          product_id: l.product_id,
          ...(l.color_id ? { color_id: l.color_id } : {}),
          sku: l.sku,
          qty: l.qty,
        })),
        delivery: { type, city_ref: cityRef, warehouse_ref: point },
        channel,
        payment,
        ...(promo.trim() ? { promo: promo.trim() } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(quote !== null ? { expected_total_minor: quote } : {}),
      };
      const order = wsId
        ? await api<Order>(
            "/wholesale/" + wsId + "/order",
            {
              lines: body.lines,
              delivery: body.delivery,
              payment,
              recipient: recipient.trim(),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
              ...(quote !== null ? { expected_total_minor: quote } : {}),
            },
            { idem: attempt.key },
          )
        : await api<Order>("/orders", body, { idem: attempt.key });
      attempt.renew();
      notify("Замовлення " + order.number + " створено");
      navigate("/orders/" + order.id);
      if (wsId) void qc.invalidateQueries({ queryKey: ["wholesale"] });
    } catch (e) {
      if (e instanceof ApiError && e.code === "PRICE_CHANGED")
        setQuote(
          Math.round(
            Number(
              (e.details.quote as { total?: number } | undefined)?.total ?? 0,
            ) * 100,
          ),
        );
      else {
        setError(e);
        attempt.afterError(e);
      }
    } finally {
      setBusy(false);
    }
  };
  const ready =
    (wsId
      ? !!wsReq && recipient.trim().length >= 2
      : name.trim().length >= 2 && !!normalized) &&
    lines.length > 0 &&
    !!cityRef &&
    !!point;
  return (
    <>
      <Link className="btn ghost small" to="/orders">
        <ArrowLeft size={16} aria-hidden="true" /> {t.nav.orders}
      </Link>
      <PageHead
        title={
          wsReq ? "Замовлення із заявки " + wsReq.number : "Нове замовлення"
        }
        text="Телефон, Instagram чи TikTok — ціну, знижки комплекту й промокоду рахує сервер."
      />
      <form
        className="grid-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        <div className="stack">
          <Panel title="Товари">
            <div className="panel-body stack">
              <ProductPicker
                onAdd={(l) => {
                  setLines((v) => [...v, l]);
                  changed();
                }}
              />
              {lines.map((l, i) => (
                <div className="line" key={i}>
                  <span className="thumb" aria-hidden="true">
                    {l.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{l.name}</strong>
                    <small className="cell-sub">{l.label}</small>
                  </span>
                  <span className="row">
                    <input
                      aria-label={"Кількість " + l.name}
                      type="number"
                      min="1"
                      max="100"
                      value={l.qty}
                      onChange={(e) => {
                        setLines((v) =>
                          v.map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  qty: Math.max(1, Number(e.target.value)),
                                }
                              : x,
                          ),
                        );
                        changed();
                      }}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={"Прибрати " + l.name}
                      onClick={() => {
                        setLines((v) => v.filter((_, n) => n !== i));
                        changed();
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ))}
              {!lines.length && (
                <p className="muted">Додайте щонайменше одну позицію.</p>
              )}
            </div>
          </Panel>
          <Panel title="Доставка Новою поштою">
            <div className="panel-body stack">
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
              <p className="muted">
                Доставку оплачує отримувач перевізнику. Замовлення оплачується
                карткою або на рахунок ФОП.
              </p>
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Клієнт">
            <div className="panel-body stack">
              {wsId ? (
                <>
                  {ws.isError && (
                    <Note tone="bad">
                      {ws.error instanceof ApiError
                        ? ws.error.message
                        : t.serviceUnavailable}{" "}
                      Заявку не відкрито — поверніться до списку заявок.
                    </Note>
                  )}
                  <Note tone="info">
                    {wsReq
                      ? "Заявка " +
                        wsReq.number +
                        ": " +
                        wsReq.name +
                        ", " +
                        (wsReq.phone_masked ?? "—") +
                        ". Покупець і телефон беруться із заявки."
                      : ws.isError
                        ? "Заявка недоступна."
                        : "Завантажуємо заявку…"}
                  </Note>
                  <label className="field">
                    Ім’я та прізвище одержувача
                    <input
                      required
                      minLength={2}
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="field">
                    Телефон (+380…)
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      aria-invalid={!!phone && !normalized}
                    />
                  </label>
                  {phone && !normalized && (
                    <small className="muted">Формат: +380 XX XXX XX XX</small>
                  )}
                  {(dupes.data?.rows.length ?? 0) > 0 && (
                    <Note tone="info">
                      Клієнт із цим номером уже є:{" "}
                      {dupes.data!.rows.map((c) => (
                        <Link
                          key={c.id}
                          className="link"
                          to={"/customers/" + encodeURIComponent(c.id)}
                        >
                          {c.name || c.id}
                        </Link>
                      ))}
                      . Замовлення буде прив’язане до кабінету лише після входу
                      клієнта з цим номером через SMS.
                    </Note>
                  )}
                  <label className="field">
                    Ім’я та прізвище
                    <input
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Отримувач (якщо інша людина)
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Email (необов’язково)
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </>
              )}
              {!wsId && (
                <label className="field">
                  Канал
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {(["phone", "instagram", "tiktok", "other"] as const).map(
                      (c) => (
                        <option key={c} value={c}>
                          {t.channel[c]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label className="field">
                Оплата
                <select
                  value={payment}
                  onChange={(e) => {
                    setPayment(e.target.value as "card" | "invoice");
                    changed();
                  }}
                >
                  <option value="card">Картка monobank (посилання)</option>
                  <option value="invoice">Рахунок ФОП</option>
                </select>
              </label>
              {!wsId && (
                <label className="field">
                  Промокод
                  <input
                    value={promo}
                    onChange={(e) => {
                      setPromo(e.target.value);
                      changed();
                    }}
                  />
                </label>
              )}
              <label className="field">
                Коментар до замовлення
                <textarea
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
            </div>
          </Panel>
          <Panel title="Разом">
            <div className="panel-body stack">
              {quote === null ? (
                <p className="muted">
                  Сума з’явиться після перевірки сервером (ціна, наявність,
                  знижки комплекту і промокоду).
                </p>
              ) : (
                <Note tone="info">
                  Сума за розрахунком сервера: <strong>{money(quote)}</strong>.
                  Погодьте її з клієнтом і підтвердьте.
                </Note>
              )}
              {error !== null && (
                <Note tone="bad">
                  {error instanceof ApiError
                    ? error.message
                    : t.serviceUnavailable}
                </Note>
              )}
              <button className="btn primary" disabled={!ready || busy}>
                {quote === null ? "Перевірити суму" : "Створити замовлення"}
              </button>
            </div>
          </Panel>
        </div>
      </form>
    </>
  );
}

/** Model → colour → size → real SKU; only what the PIM mirror publishes. */
function ProductPicker({ onAdd }: { onAdd: (l: Line) => void }) {
  const [text, setText] = useState(""),
    [pid, setPid] = useState(""),
    [color, setColor] = useState(""),
    [sku, setSku] = useState("");
  const q = useDebounce(text);
  const found = useQuery({
    queryKey: ["products", "pick", q],
    queryFn: () =>
      api<ProductList>("/products" + params({ q, published: "1", limit: 8 })),
    enabled: q.trim().length >= 2 && !pid,
  });
  const detail = useQuery({
    queryKey: ["product", pid],
    queryFn: () => api<ProductDetail>("/products/" + encodeURIComponent(pid)),
    enabled: !!pid,
  });
  const variants = (detail.data?.variants ?? []) as Variant[];
  const colors = Array.from(
    new Map(variants.map((v) => [v.pim_color_id ?? "", v.color])).entries(),
  );
  const sizes = variants.filter(
    (v) =>
      (v.pim_color_id ?? "") === color &&
      !["OUT_OF_STOCK", "UNKNOWN"].includes(v.availability),
  );
  const reset = () => {
    setPid("");
    setColor("");
    setSku("");
    setText("");
  };
  if (!pid)
    return (
      <div className="stack">
        <SearchBox
          value={text}
          onChange={setText}
          placeholder="Модель або SKU"
        />
        {(
          found.data?.rows as
            | { id: string; name: string; skus: number }[]
            | undefined
        )?.map((p) => (
          <button
            type="button"
            key={p.id}
            className="cmdk-item"
            onClick={() => setPid(p.id)}
          >
            <span>
              {p.name}
              <small className="cell-sub">{p.skus} SKU</small>
            </span>
          </button>
        ))}
      </div>
    );
  const chosen = variants.find((v) => v.sku === sku);
  return (
    <div className="parcel">
      <strong>
        {String(
          (detail.data?.product as { name?: string } | undefined)?.name ?? "",
        )}
      </strong>
      <label className="field">
        Колір
        <select
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setSku("");
          }}
        >
          <option value="">Оберіть</option>
          {colors.map(([id, c]) => (
            <option key={id} value={id}>
              {c || "Без кольору"}
            </option>
          ))}
        </select>
      </label>
      {color !== "" || colors.length === 1 ? (
        <label className="field">
          Розмір
          <select value={sku} onChange={(e) => setSku(e.target.value)}>
            <option value="">Оберіть</option>
            {(colors.length === 1 ? variants : sizes).map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.pim_size_display || v.sku} ·{" "}
                {v.availability === "IN_STOCK" ? "є" : "під замовлення"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="row">
        <button
          type="button"
          className="btn primary"
          disabled={!chosen}
          onClick={() => {
            if (chosen) {
              onAdd({
                product_id: pid,
                name: String((detail.data?.product as { name?: string }).name),
                color_id: chosen.pim_color_id,
                sku: chosen.sku,
                label: `${chosen.sku} · ${chosen.color} · ${chosen.pim_size_display ?? ""}`,
                qty: 1,
                price_minor: chosen.price_minor,
              });
              reset();
            }
          }}
        >
          <Plus size={16} aria-hidden="true" /> Додати
        </button>
        <button type="button" className="btn ghost" onClick={reset}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
