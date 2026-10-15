import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Session, TotpSetup } from "./contract.gen";
import { api, ApiError, copy, setStepUpHandler } from "./lib";
import { Dialog, Note } from "./kit";
import { t } from "./i18n";

function Card({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="login">
      <section className="panel login-card">
        <div className="row">
          <span className="brand-mark" aria-hidden="true">
            Р
          </span>
          <strong>{t.brand} · CRM</strong>
        </div>
        <h1>{title}</h1>
        {text && <p className="sub">{text}</p>}
        {children}
        <p className="row muted">
          <ShieldCheck size={15} aria-hidden="true" /> Доступ лише для
          співробітників РУБІЖ
        </p>
      </section>
    </main>
  );
}
const message = (e: unknown) =>
  e instanceof ApiError ? e.message : t.serviceUnavailable;

export function Login({ done }: { done: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [backup, setBackup] = useState(false);
  const [needCode, setNeedCode] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api<Session>("/auth/login", {
        email,
        password,
        ...(needCode
          ? backup
            ? { backup_code: code.trim().toLowerCase() }
            : { totp: code.trim() }
          : {}),
      });
      setPassword("");
      done();
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOTP_REQUIRED")
        setNeedCode(true);
      else if (e instanceof ApiError && e.code === "CHECK_REQUIRED")
        window.location.assign("/auth/staff-login.php");
      else setError(e);
      if (!(e instanceof ApiError && e.code === "TOTP_REQUIRED")) setCode("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="Вхід до CRM"
      text="Замовлення, оплати й доставка — в одному місці."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {needCode && (
          <>
            <label className="field">
              {backup
                ? "Резервний код (xxxx-xxxx)"
                : "Код із додатка автентифікації"}
              <input
                inputMode={backup ? "text" : "numeric"}
                autoComplete="one-time-code"
                required
                pattern={backup ? "[a-z0-9]{4}-[a-z0-9]{4}" : "[0-9]{6}"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                data-autofocus
              />
            </label>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                setBackup((v) => !v);
                setCode("");
              }}
            >
              {backup ? "Ввести код із додатка" : "Використати резервний код"}
            </button>
          </>
        )}
        {error !== null && <Note tone="bad">{message(error)}</Note>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Входимо…" : "Увійти"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </Card>
  );
}

/** OWNER and ACCOUNTANT cannot see CRM data before TOTP is enabled (ТЗ §8). */
export function TotpEnroll({
  done,
  logout,
}: {
  done: () => void;
  logout: () => void;
}) {
  const [setup, setSetup] = useState<TotpSetup | null>(null),
    [code, setCode] = useState(""),
    [codes, setCodes] = useState<string[] | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const start = async () => {
    setError(null);
    try {
      setSetup(await api<TotpSetup>("/auth/totp/setup", {}));
    } catch (e) {
      setError(e);
    }
  };
  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      setCodes(
        (
          await api<{ backup_codes: string[] }>("/auth/totp/enable", {
            code: code.trim(),
          })
        ).backup_codes,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (codes)
    return (
      <Card
        title="Двофакторну перевірку ввімкнено"
        text="Збережіть резервні коди в надійному місці. Кожен код діє один раз, якщо телефон недоступний."
      >
        <div className="codes" aria-label="Резервні коди">
          {codes.map((c) => (
            <code key={c}>{c}</code>
          ))}
        </div>
        <button className="btn" onClick={() => void copy(codes.join("\n"))}>
          Скопіювати коди
        </button>
        <button className="btn primary" onClick={done}>
          Я зберіг коди — продовжити
        </button>
      </Card>
    );
  return (
    <Card
      title="Підключіть двофакторну перевірку"
      text="Для вашої ролі вхід потребує коду з додатка автентифікації (Google Authenticator, 1Password, Aegis тощо)."
    >
      {!setup ? (
        <button className="btn primary" onClick={() => void start()}>
          Почати підключення
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enable();
          }}
        >
          <p>
            Додайте в додаток ключ вручну або відкрийте посилання на телефоні:
          </p>
          <code className="num">
            {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
          </code>
          <a className="link" href={setup.otpauth_uri}>
            Відкрити в додатку автентифікації
          </a>
          <label className="field">
            Код із додатка
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Увімкнути
          </button>
        </form>
      )}
      {error !== null && <Note tone="bad">{message(error)}</Note>}
      <button className="btn ghost" onClick={logout}>
        {t.logout}
      </button>
    </Card>
  );
}

/** Invite or password-reset link: /crm/accept?token=… → a new password (≥ 12, not common). */
export function AcceptToken({ token }: { token: string }) {
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [state, setState] = useState<"form" | "done">("form"),
    [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setError(null);
    if (password !== repeat) {
      setError(new ApiError("MISMATCH", "Паролі не збігаються.", {}, 400));
      return;
    }
    try {
      await api("/auth/token/accept", { token, password });
      setState("done");
    } catch (e) {
      setError(e);
    }
  };
  if (state === "done")
    return (
      <Card title="Пароль встановлено" text="Тепер увійдіть із новим паролем.">
        <a className="btn primary" href="/crm/">
          Перейти до входу
        </a>
      </Card>
    );
  return (
    <Card
      title="Встановіть пароль"
      text="Щонайменше 12 символів; не використовуйте поширені паролі чи частину email."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          Новий пароль
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          Повторіть пароль
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        {error !== null && <Note tone="bad">{message(error)}</Note>}
        <button className="btn primary">Зберегти пароль</button>
      </form>
    </Card>
  );
}

/** Global step-up: any STEP_UP_REQUIRED opens this dialog; after a successful re-entry the same attempt repeats. */
export function StepUpHost({ totp }: { totp: boolean }) {
  const [pending, setPending] = useState<((ok: boolean) => void) | null>(null);
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setStepUpHandler(
      () => new Promise<boolean>((resolve) => setPending(() => resolve)),
    );
    return () => setStepUpHandler(null);
  }, []);
  if (!pending) return null;
  const finish = (ok: boolean) => {
    pending(ok);
    setPending(null);
    setPassword("");
    setCode("");
    setError(null);
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reauth", {
        password,
        ...(totp ? { totp: code.trim() } : {}),
      });
      finish(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={t.stepUpTitle} onClose={() => finish(false)}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p>{t.stepUpText}</p>
        <label className="field">
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-autofocus
          />
        </label>
        {totp && (
          <label className="field">
            Код із додатка
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        {error !== null && <Note tone="bad">{message(error)}</Note>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => finish(false)}>
            {t.cancel}
          </button>
          <button className="btn primary" disabled={busy}>
            {t.confirm}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
