import { useEffect, useState } from "react";
import {
  NavLink,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Truck,
  CreditCard,
  RotateCcw,
  ChartNoAxesCombined,
  ScrollText,
  Settings,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  Command,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "./api";
import type { Staff, Dashboard, Order, Customer, Shipment } from "./api";
import { Workspace } from "./context";
import { label, Dialog, ErrorBox, Loading, Toast, useDebounce } from "./ui";
import { Overview, Reports } from "./overview";
import { Orders, OrderPage } from "./orders";
import {
  Customers,
  CustomerPage,
  Payments,
  PaymentPage,
  Shipments,
  ShipmentPage,
  Returns,
  ReturnPage,
  AuditPage,
  SettingsPage,
} from "./sections";
const navigation = [
  ["", "Огляд", LayoutDashboard],
  ["orders", "Замовлення", ShoppingBag],
  ["customers", "Клієнти", Users],
  ["shipments", "Відправлення", Truck],
  ["payments", "Платежі", CreditCard],
  ["returns", "Повернення", RotateCcw],
  ["reports", "Звіти", ChartNoAxesCombined],
  ["audit", "Журнал дій", ScrollText],
  ["settings", "Налаштування", Settings],
] as const;
function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
export function App() {
  const client = useQueryClient();
  useEffect(() => {
    const h = () => {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      client.invalidateQueries({ queryKey: ["session"] });
    };
    window.addEventListener("crm-auth-required", h);
    return () => window.removeEventListener("crm-auth-required", h);
  }, [client]);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) =>
      api<{ authenticated: boolean; user: Staff | null }>(
        "/auth/session",
        undefined,
        "GET",
        signal,
      ),
    retry: false,
  });
  const [toast, setToast] = useState("");
  if (session.isPending)
    return (
      <div className="boot">
        <Mark />
        <Loading />
      </div>
    );
  if (session.isError)
    return (
      <div className="boot">
        <ErrorBox error={session.error} onRetry={() => session.refetch()} />
      </div>
    );
  if (!session.data.user)
    return (
      <Login done={() => client.invalidateQueries({ queryKey: ["session"] })} />
    );
  return (
    <Workspace.Provider value={{ user: session.data.user, notify: setToast }}>
      <Shell user={session.data.user} />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </Workspace.Provider>
  );
}
function Login({ done }: { done: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api("/auth/login", { email, password }),
    onSuccess: () => {
      setPassword("");
      done();
    },
    onError: () => setPassword(""),
  });
  return (
    <div className="login-page">
      <div className="login-brand">
        <Mark />
        <span>РУБІЖ</span>
      </div>
      <div className="login-card">
        <div className="eyebrow">РОБОЧИЙ ПРОСТІР</div>
        <h1>Увійти до РУБІЖ</h1>
        <p>Замовлення, клієнти та операції — в одному місці.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <label>
            Email співробітника
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {login.isError && <ErrorBox error={login.error} />}
          <button className="btn primary" disabled={login.isPending}>
            {login.isPending ? "Входимо…" : "Увійти"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="login-foot">
          <ShieldCheck size={15} /> Доступ лише для уповноважених співробітників
        </div>
      </div>
      <span className="login-bottom">РУБІЖ · Операційний простір</span>
    </div>
  );
}
function Shell({ user }: { user: Staff }) {
  const client = useQueryClient(),
    location = useLocation(),
    navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [profile, setProfile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [light, setLight] = useState(localStorage.getItem("crm.theme") === "light");
  const [keyError, setKeyError] = useState<Error | null>(null);
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) =>
      api<Dashboard>("/dashboard", undefined, "GET", signal),
    enabled: notifications,
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", {}),
    onSuccess: () => {
      client.clear();
      navigate("/");
    },
    onError: setKeyError,
  });
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("crm.theme", light ? "light" : "dark");
  }, [light]);
  useEffect(() => {
    setMobile(false);
    setProfile(false);
    setNotifications(false);
  }, [location.pathname]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") {
        setMobile(false);
        setProfile(false);
        setNotifications(false);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const title =
    navigation.find(
      ([p]) => p === (location.pathname.split("/")[1] ?? ""),
    )?.[1] ?? "Робочий простір";
  return (
    <div className={"app-shell " + (collapsed ? "collapsed" : "")}>
      {mobile && (
        <div className="mobile-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <div className="brand">
          <Link to="/" aria-label="РУБІЖ — огляд">
            <Mark />
            <span>РУБІЖ</span>
          </Link>
          <button
            className="icon-btn mobile-only"
            aria-label="Закрити меню"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-dot" />
          <div>
            Операційний простір<small>РУБІЖ CRM</small>
          </div>
        </div>
        <div className="nav-label">РОБОЧИЙ ПРОСТІР</div>
        <nav>
          {navigation.map(([path, name, Icon]) => (
            <NavLink
              key={path}
              to={"/" + path}
              end={path === ""}
              title={collapsed ? name : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {path === "orders" && <i className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={16} />
            <span>{label(user.role)}</span>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Розгорнути панель" : "Згорнути панель"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span>Згорнути панель</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-only"
              aria-label="Відкрити меню"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="topbar-workspace">Робочий простір</span>
            <span className="crumb-separator">/</span>
            <span>{title}</span>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearch(true)}>
              <Search size={16} />
              <span>Пошук у просторі</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="popover-anchor">
              <button
                className={"icon-btn " + (notifications ? "selected" : "")}
                aria-label="Важливі сповіщення"
                onClick={() => {
                  setNotifications((v) => !v);
                  setProfile(false);
                }}
              >
                <Bell size={18} />
              </button>
              {notifications && (
                <div className="popover notifications">
                  <h3>Потребують уваги</h3>
                  {dashboard.isPending ? (
                    <Loading />
                  ) : dashboard.isError ? (
                    <ErrorBox error={dashboard.error} />
                  ) : (
                    <>
                      {[
                        ...(dashboard.data?.problems ?? []),
                        ...(dashboard.data?.requires_action ?? []),
                      ]
                        .slice(0, 6)
                        .map((o) => (
                          <Link key={o.id} to={"/orders/" + o.id}>
                            <span>{o.number}</span>
                            <small>
                              {label(o.blockers[0] ?? o.order_status)}
                            </small>
                          </Link>
                        ))}
                      {!dashboard.data?.requires_action.length &&
                        !dashboard.data?.problems.length && (
                          <p>Критичних задач немає.</p>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              className="icon-btn theme-button"
              aria-label={
                light ? "Увімкнути темну тему" : "Увімкнути світлу тему"
              }
              onClick={() => setLight((v) => !v)}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="popover-anchor">
              <button
                className="profile-trigger"
                onClick={() => {
                  setProfile((v) => !v);
                  setNotifications(false);
                }}
                aria-label="Профіль співробітника"
              >
                <span className="avatar">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <ChevronDown size={13} />
              </button>
              {profile && (
                <div className="popover">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  <span className="profile-role">{label(user.role)}</span>
                  <button
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <LogOut size={15} />
                    Вийти з простору
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          {keyError && <ErrorBox error={keyError} />}
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderPage />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerPage />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/:id" element={<PaymentPage />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/shipments/:id" element={<ShipmentPage />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/returns/:id" element={<ReturnPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Сторінку не знайдено</h1>
                  <Link className="btn" to="/">
                    Повернутися до огляду
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="workspace-footer">
          <span>
            <i /> Робочий простір РУБІЖ
          </span>
          <span>РУБІЖ · Україна</span>
        </footer>
      </div>
      {search && <CommandSearch onClose={() => setSearch(false)} />}
    </div>
  );
}
function CommandSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState(""),
    [active, setActive] = useState(0);
  const q = useDebounce(input);
  const result = useQuery({
    queryKey: ["search", q],
    queryFn: ({ signal }) =>
      api<{ orders: Order[]; customers: Customer[]; shipments: Shipment[] }>(
        "/search?q=" + encodeURIComponent(q),
        undefined,
        "GET",
        signal,
      ),
    enabled: q.length >= 2,
  });
  const entries = [
    ...(result.data?.orders ?? []).map((o) => ({
      id: "o" + o.id,
      group: "Замовлення",
      label: o.number,
      detail: o.customer.name,
      path: "/orders/" + o.id,
    })),
    ...(result.data?.customers ?? []).map((c) => ({
      id: "c" + c.id,
      group: "Клієнти",
      label: c.name || c.email,
      detail: c.phone ?? "",
      path: "/customers/" + encodeURIComponent(c.id),
    })),
    ...(result.data?.shipments ?? []).map((s) => ({
      id: "s" + s.id,
      group: "Відправлення",
      label: s.tracking_number ?? "Чернетка",
      detail: s.order_number,
      path: "/shipments/" + s.id,
    })),
  ];
  useEffect(() => setActive(0), [q]);
  const choose = (path: string) => {
    navigate(path);
    onClose();
  };
  return (
    <Dialog title="Пошук у просторі" onClose={onClose} wide>
      <div className="command-search">
        <Search size={19} />
        <input
          aria-label="Глобальний пошук"
          autoFocus
          value={input}
          placeholder="Замовлення, клієнт, телефон, SKU або ТТН…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((v) => Math.min(v + 1, entries.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter" && entries[active])
              choose(entries[active].path);
          }}
        />
      </div>
      <div className="command-results">
        {result.isFetching ? (
          <Loading />
        ) : result.isError ? (
          <ErrorBox error={result.error} />
        ) : q.length < 2 ? (
          <p className="command-hint">Введіть щонайменше 2 символи</p>
        ) : !entries.length ? (
          <p className="command-hint">Збігів не знайдено</p>
        ) : (
          entries.map((r, i) => (
            <div key={r.id}>
              {(i === 0 || r.group !== entries[i - 1].group) && (
                <div className="command-group">{r.group}</div>
              )}
              <button
                className={"command-result " + (i === active ? "active" : "")}
                onClick={() => choose(r.path)}
                onMouseEnter={() => setActive(i)}
              >
                <span>
                  {r.label}
                  <small>{r.detail}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="command-footer">
        <span>
          <Command size={12} /> Замовлення · Клієнти · Відправлення
        </span>
        <span>↑ ↓ вибір · Enter відкрити · Esc закрити</span>
      </div>
    </Dialog>
  );
}
