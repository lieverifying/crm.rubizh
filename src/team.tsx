import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, UserPlus } from "lucide-react";
import type {
  SessionList,
  Settings,
  StaffList,
  TokenLink,
} from "./contract.gen";
import { api, copy, date, useCan, useWorkspace } from "./lib";
import type { Column } from "./kit";
import {
  ActionDialog,
  DataView,
  Empty,
  ErrorBox,
  Loading,
  Note,
  PageHead,
  Panel,
  Pill,
} from "./kit";
import { t } from "./i18n";

type Person = {
  id: string;
  email: string;
  name: string;
  role: string;
  enabled: number;
  session_version: number;
  totp_enabled: boolean;
  last_seen: string | null;
  sessions: number;
};
/** Staff (OWNER, ТЗ 7.12): invite by one-time link, role, deactivation (sessions end at once), reset link, forced logout. */
export function Staff() {
  const client = useQueryClient();
  const { notify } = useWorkspace();
  const q = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<StaffList>("/staff"),
  });
  const [dialog, setDialog] = useState<{
    kind: "invite" | "edit" | "reset" | "logout";
    person?: Person;
  } | null>(null);
  const [link, setLink] = useState<TokenLink | null>(null);
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState("MANAGER"),
    [enabled, setEnabled] = useState(true);
  const refresh = () => client.invalidateQueries({ queryKey: ["staff"] });
  const columns: Column<Person>[] = [
    {
      key: "name",
      title: "Співробітник",
      render: (p) => (
        <>
          {p.name}
          <small>{p.email}</small>
        </>
      ),
    },
    { key: "role", title: "Роль", render: (p) => t.roles[p.role] ?? p.role },
    {
      key: "state",
      title: "Стан",
      render: (p) =>
        p.enabled ? (
          <Pill code="PAID">активний</Pill>
        ) : (
          <Pill code="FAILED">вимкнено</Pill>
        ),
    },
    {
      key: "totp",
      title: "2FA",
      render: (p) => (p.totp_enabled ? "так" : "ні"),
    },
    {
      key: "seen",
      title: "Остання активність",
      render: (p) => (
        <>
          {date(p.last_seen, true)}
          <small>сесій: {p.sessions}</small>
        </>
      ),
    },
    {
      key: "act",
      title: "",
      render: (p) => (
        <span className="row">
          <button
            className="btn small"
            onClick={() => {
              setRole(p.role);
              setEnabled(!!p.enabled);
              setName(p.name);
              setDialog({ kind: "edit", person: p });
            }}
          >
            Змінити
          </button>
          <button
            className="btn small"
            onClick={() => setDialog({ kind: "reset", person: p })}
          >
            Скинути пароль
          </button>
          <button
            className="btn small"
            onClick={() => setDialog({ kind: "logout", person: p })}
          >
            Вийти з усіх сесій
          </button>
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHead
        title={t.nav.staff}
        text="Зміни потребують повторного входу. Останнього власника не можна вимкнути."
        actions={
          <button
            className="btn primary"
            onClick={() => {
              setEmail("");
              setName("");
              setRole("MANAGER");
              setDialog({ kind: "invite" });
            }}
          >
            <UserPlus size={16} aria-hidden="true" /> Запросити
          </button>
        }
      />
      <Panel>
        {q.isPending ? (
          <Loading rows={4} />
        ) : q.isError ? (
          <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data.rows.length ? (
          <Empty />
        ) : (
          <DataView
            rows={q.data.rows as Person[]}
            columns={columns}
            rowKey={(p) => p.id}
            card={(p) => (
              <div className="mcard">
                <div className="mcard-top">
                  <strong>{p.name}</strong>
                  {p.enabled ? (
                    <Pill code="PAID">{t.roles[p.role]}</Pill>
                  ) : (
                    <Pill code="FAILED">вимкнено</Pill>
                  )}
                </div>
                <span className="sub">{p.email}</span>
                <div className="row">{columns[5].render(p)}</div>
              </div>
            )}
          />
        )}
      </Panel>
      {link && (
        <ActionDialog
          title="Одноразове посилання"
          submitText="Скопіювати й закрити"
          onClose={() => setLink(null)}
          onSubmit={async () => {
            notify((await copy(link.url)) ? t.copied : t.copyFailed);
          }}
        >
          <p>
            Передайте посилання співробітнику особисто. Діє до{" "}
            {date(link.expires_at, true)}; після використання стає недійсним.
            {link.delivery === "mock"
              ? " (Стенд: лист записано в тестову скриньку.)"
              : ""}
          </p>
          <input
            readOnly
            value={link.url}
            aria-label="Посилання"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="btn"
            onClick={async () =>
              notify((await copy(link.url)) ? t.copied : t.copyFailed)
            }
          >
            <Copy size={16} aria-hidden="true" /> Скопіювати
          </button>
        </ActionDialog>
      )}
      {dialog?.kind === "invite" && (
        <ActionDialog
          title="Запросити співробітника"
          needReason
          onClose={() => setDialog(null)}
          onSubmit={async ({ key, reason }) => {
            setLink(
              await api<TokenLink>(
                "/staff/invite",
                { email: email.trim(), name: name.trim(), role, reason },
                { idem: key },
              ),
            );
            void refresh();
          }}
        >
          <label className="field">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Ім’я
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <RoleSelect value={role} onChange={setRole} />
        </ActionDialog>
      )}
      {dialog?.kind === "edit" && dialog.person && (
        <ActionDialog
          title={"Змінити: " + dialog.person.name}
          needReason
          onClose={() => setDialog(null)}
          onSubmit={async ({ key, reason }) => {
            await api(
              "/staff/" + dialog.person!.id,
              {
                session_version: dialog.person!.session_version,
                role,
                enabled,
                name: name.trim(),
                reason,
              },
              { idem: key },
            );
            void refresh();
          }}
        >
          <label className="field">
            Ім’я
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <RoleSelect value={role} onChange={setRole} />
          <label className="check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Активний (вимкнення одразу завершує всі сесії та знімає призначені
            замовлення)
          </label>
        </ActionDialog>
      )}
      {dialog?.kind === "reset" && dialog.person && (
        <ActionDialog
          title="Скинути пароль"
          needReason
          onClose={() => setDialog(null)}
          onSubmit={async ({ key, reason }) => {
            setLink(
              await api<TokenLink>(
                `/staff/${dialog.person!.id}/reset-password`,
                { reason },
                { idem: key },
              ),
            );
          }}
        >
          <p>
            {dialog.person.name} отримає одноразове посилання (2 години) для
            нового пароля. Поточні сесії завершаться після встановлення.
          </p>
        </ActionDialog>
      )}
      {dialog?.kind === "logout" && dialog.person && (
        <ActionDialog
          title="Примусовий вихід"
          needReason
          onClose={() => setDialog(null)}
          onSubmit={async ({ key, reason }) => {
            await api(
              `/staff/${dialog.person!.id}/logout`,
              { reason },
              { idem: key },
            );
            void refresh();
          }}
        >
          <p>Усі сесії {dialog.person.name} буде завершено негайно.</p>
        </ActionDialog>
      )}
    </>
  );
}
function RoleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      Роль
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(t.roles).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Settings (ТЗ 7.15): personal (name, theme, password, sessions), system thresholds (OWNER), feature flags read-only. */
export function SettingsPage() {
  const can = useCan();
  const client = useQueryClient();
  const { notify, user } = useWorkspace();
  const s = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/settings"),
  });
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<SessionList>("/me/sessions"),
  });
  const [pw, setPw] = useState(false),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState("");
  const [sys, setSys] = useState<Record<string, number> | null>(null);
  if (s.isPending) return <Loading rows={6} />;
  if (s.isError)
    return <ErrorBox error={s.error} onRetry={() => void s.refetch()} />;
  const flags = s.data.flags as Record<string, boolean>;
  const system = (sys ?? s.data.system) as Record<string, number> | null;
  const systemNames: Record<string, string> = {
    vip_paid_orders: "VIP: оплачених замовлень від",
    vip_paid_total_minor: "VIP: оплачено від (коп.)",
    sleeping_days: "Сплячий клієнт: днів без замовлень",
    auto_task_unconfirmed_minutes: "Автозавдання: без підтвердження, хв",
    auto_task_no_ttn_hours: "Автозавдання: оплачене без ТТН, год",
    invoice_grace_workdays: "Рахунок ФОП: днів звірки після строку",
    direct_pay_max_qty: "Оплата одразу при невідомому залишку: до, шт.",
  };
  const flagNames: Record<string, string> = {
    crm_enabled: "CRM увімкнено",
    crm_refund_live: "Повернення коштів через банк",
    crm_np_ttn_live: "Створення ТТН у Новій пошті",
    crm_np_tracking_live: "Трекінг Нової пошти",
    crm_sms_live: "SMS клієнтам",
    crm_email_live: "Email",
    np_ttn_enabled: "Випуск ТТН дозволено власником",
  };
  return (
    <>
      <PageHead
        title={t.nav.settings}
        text={user.name + " · " + t.roles[user.role]}
      />
      <div className="grid-even">
        <Panel title="Особисті">
          <div className="panel-body stack">
            <span>
              Двофакторна перевірка:{" "}
              {user.totp_enabled ? (
                <Pill code="PAID">увімкнено</Pill>
              ) : (
                <Pill code="AWAITING">вимкнено</Pill>
              )}
            </span>
            <button className="btn" onClick={() => setPw(true)}>
              Змінити пароль
            </button>
            <h3>Активні сесії</h3>
            {(sessions.data?.rows ?? []).map((x) => (
              <div key={x.id} className="row">
                <span>{x.agent || "браузер"}</span>
                <span className="muted">{date(x.seen_at, true)}</span>
                {x.current && <Pill code="PAID">ця сесія</Pill>}
              </div>
            ))}
            <button
              className="btn"
              onClick={async () => {
                await api("/me/sessions/revoke-others", {});
                notify("Інші сесії завершено");
                void sessions.refetch();
              }}
            >
              Завершити інші сесії
            </button>
          </div>
        </Panel>
        <Panel
          title="Підключення сервісів"
          meta={<span className="muted">лише перегляд</span>}
        >
          <div className="panel-body stack">
            {Object.entries(flags).map(([k, v]) => (
              <div key={k} className="row">
                <span>{flagNames[k] ?? k}</span>
                <span className="spacer" />
                {v ? (
                  <Pill code="PAID">увімкнено</Pill>
                ) : (
                  <Pill code="">вимкнено</Pill>
                )}
              </div>
            ))}
            <Note tone="info">
              Перемикаються лише в конфігурації сервера за чек-листом
              підключення. Вимкнене «живе» підключення на стенді працює через
              тестові заглушки.
            </Note>
          </div>
        </Panel>
      </div>
      {can("settings.system") && system && (
        <Panel title="Системні пороги">
          <form
            className="panel-body stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/settings/system", system);
                notify(t.done);
                void client.invalidateQueries({ queryKey: ["settings"] });
              } catch (x) {
                notify((x as Error).message, "error");
              }
            }}
          >
            <div className="grid-even">
              {Object.entries(system).map(([k, v]) => (
                <label className="field" key={k}>
                  {systemNames[k] ?? k}
                  <input
                    type="number"
                    min="0"
                    value={v}
                    onChange={(e) =>
                      setSys({ ...system, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <button className="btn primary">{t.save}</button>
          </form>
        </Panel>
      )}
      {pw && (
        <ActionDialog
          title="Змінити пароль"
          onClose={() => setPw(false)}
          onSubmit={async ({ key }) => {
            await api(
              "/me/password",
              { current, password: next },
              { idem: key },
            );
            notify("Пароль змінено, інші сесії завершено");
          }}
        >
          <label className="field">
            Поточний пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="field">
            Новий пароль (від 12 символів)
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
        </ActionDialog>
      )}
    </>
  );
}
