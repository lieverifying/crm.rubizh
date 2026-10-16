import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  Truck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type {
  NotificationList,
  Permission,
  SearchResult,
  Session,
} from "./contract.gen";
import {
  api,
  holdWhileLeaving,
  initials,
  params,
  useCan,
  useWorkspace,
  WorkspaceContext,
} from "./lib";
import { Dialog, ErrorBox, Loading, Toast, useDebounce } from "./kit";
import { AcceptToken, Login, StepUpHost, TotpEnroll } from "./auth";
import { t } from "./i18n";

const Overview = lazy(
  holdWhileLeaving(() =>
    import("./overview").then((m) => ({ default: m.Overview })),
  ),
);
const Analytics = lazy(
  holdWhileLeaving(() =>
    import("./overview").then((m) => ({ default: m.Analytics })),
  ),
);
const Orders = lazy(
  holdWhileLeaving(() =>
    import("./orders").then((m) => ({ default: m.Orders })),
  ),
);
const OrderCard = lazy(
  holdWhileLeaving(() =>
    import("./order-card").then((m) => ({ default: m.OrderCard })),
  ),
);
const OrderCreate = lazy(
  holdWhileLeaving(() =>
    import("./order-create").then((m) => ({ default: m.OrderCreate })),
  ),
);
const Payments = lazy(
  holdWhileLeaving(() =>
    import("./money").then((m) => ({ default: m.Payments })),
  ),
);
const PaymentCard = lazy(
  holdWhileLeaving(() =>
    import("./money").then((m) => ({ default: m.PaymentCard })),
  ),
);
const Returns = lazy(
  holdWhileLeaving(() =>
    import("./money").then((m) => ({ default: m.Returns })),
  ),
);
const ReturnCard = lazy(
  holdWhileLeaving(() =>
    import("./money").then((m) => ({ default: m.ReturnCard })),
  ),
);
const Customers = lazy(
  holdWhileLeaving(() =>
    import("./sections").then((m) => ({ default: m.Customers })),
  ),
);
const CustomerCard = lazy(
  holdWhileLeaving(() =>
    import("./sections").then((m) => ({ default: m.CustomerCard })),
  ),
);
const Delivery = lazy(
  holdWhileLeaving(() =>
    import("./sections").then((m) => ({ default: m.Delivery })),
  ),
);
const ShipmentCard = lazy(
  holdWhileLeaving(() =>
    import("./sections").then((m) => ({ default: m.ShipmentCard })),
  ),
);
const Products = lazy(
  holdWhileLeaving(() =>
    import("./catalog").then((m) => ({ default: m.Products })),
  ),
);
const ProductCard = lazy(
  holdWhileLeaving(() =>
    import("./catalog").then((m) => ({ default: m.ProductCard })),
  ),
);
const Suppliers = lazy(
  holdWhileLeaving(() =>
    import("./catalog").then((m) => ({ default: m.Suppliers })),
  ),
);
const SupplierCard = lazy(
  holdWhileLeaving(() =>
    import("./catalog").then((m) => ({ default: m.SupplierCard })),
  ),
);
const Tasks = lazy(
  holdWhileLeaving(() => import("./work").then((m) => ({ default: m.Tasks }))),
);
const Notifications = lazy(
  holdWhileLeaving(() =>
    import("./work").then((m) => ({ default: m.Notifications })),
  ),
);
const Activity = lazy(
  holdWhileLeaving(() =>
    import("./work").then((m) => ({ default: m.Activity })),
  ),
);
const Staff = lazy(
  holdWhileLeaving(() => import("./team").then((m) => ({ default: m.Staff }))),
);
const SettingsPage = lazy(
  holdWhileLeaving(() =>
    import("./team").then((m) => ({ default: m.SettingsPage })),
  ),
);

type NavItem = {
  path: string;
  name: string;
  icon: typeof LayoutDashboard;
  perm: Permission;
};
const NAV: [string, NavItem[]][] = [
  [
    t.nav.groups.main,
    [
      {
        path: "",
        name: t.nav.overview,
        icon: LayoutDashboard,
        perm: "dashboard.view",
      },
      {
        path: "orders",
        name: t.nav.orders,
        icon: ShoppingBag,
        perm: "order.view",
      },
      {
        path: "customers",
        name: t.nav.customers,
        icon: Users,
        perm: "customer.view",
      },
      {
        path: "tasks",
        name: t.nav.tasks,
        icon: ClipboardList,
        perm: "task.view",
      },
    ],
  ],
  [
    t.nav.groups.sales,
    [
      {
        path: "analytics",
        name: t.nav.analytics,
        icon: BarChart3,
        perm: "report.view",
      },
      {
        path: "payments",
        name: t.nav.payments,
        icon: CreditCard,
        perm: "payment.view",
      },
      {
        path: "returns",
        name: t.nav.returns,
        icon: RotateCcw,
        perm: "return.view",
      },
    ],
  ],
  [
    t.nav.groups.catalog,
    [
      {
        path: "products",
        name: t.nav.products,
        icon: Boxes,
        perm: "product.view",
      },
      {
        path: "suppliers",
        name: t.nav.suppliers,
        icon: Factory,
        perm: "supplier.view",
      },
      {
        path: "delivery",
        name: t.nav.delivery,
        icon: Truck,
        perm: "shipment.view",
      },
    ],
  ],
  [
    t.nav.groups.team,
    [
      { path: "staff", name: t.nav.staff, icon: UserCog, perm: "staff.manage" },
      {
        path: "activity",
        name: t.nav.activity,
        icon: ScrollText,
        perm: "audit.view",
      },
    ],
  ],
  [
    t.nav.groups.system,
    [
      {
        path: "notifications",
        name: t.nav.notifications,
        icon: Bell,
        perm: "notification.view",
      },
      {
        path: "settings",
        name: t.nav.settings,
        icon: Settings,
        perm: "settings.personal",
      },
    ],
  ],
];

export function App() {
  const client = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    const h = () => {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      void client.invalidateQueries({ queryKey: ["session"] });
    };
    window.addEventListener("crm-auth-required", h);
    return () => window.removeEventListener("crm-auth-required", h);
  }, [client]);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) =>
      api<Session>("/auth/session", undefined, { signal }),
    retry: false,
    staleTime: 60_000,
  });
  const [toast, setToast] = useState<{
    message: string;
    tone: "ok" | "error";
  } | null>(null);
  const notify = useCallback(
    (message: string, tone: "ok" | "error" = "ok") =>
      setToast({ message, tone }),
    [],
  );
  const refresh = () =>
    void client.invalidateQueries({ queryKey: ["session"] });
  const logout = async () => {
    try {
      await api("/auth/logout", {});
    } finally {
      client.clear();
      window.location.assign("/crm/");
    }
  };
  if (location.pathname === "/accept")
    return (
      <AcceptToken
        token={new URLSearchParams(location.search).get("token") ?? ""}
      />
    );
  if (session.isPending)
    return (
      <main className="login">
        <Loading />
      </main>
    );
  if (session.isError)
    return (
      <main className="login">
        <ErrorBox
          error={session.error}
          onRetry={() => void session.refetch()}
        />
      </main>
    );
  if (!session.data.user) return <Login done={refresh} />;
  if (session.data.totp_enroll_required)
    return <TotpEnroll done={refresh} logout={() => void logout()} />;
  return (
    <WorkspaceContext.Provider value={{ user: session.data.user, notify }}>
      <Shell logout={() => void logout()} />
      <StepUpHost totp={!!session.data.user.totp_enabled} />
      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </WorkspaceContext.Provider>
  );
}

/** Light by default; the choice is remembered in the browser and in the staff profile. */
function useTheme() {
  const read = (): "light" | "dark" => {
    try {
      return localStorage.getItem("crm.theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  };
  const [theme, setTheme] = useState<"light" | "dark">(read);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("crm.theme", theme);
    } catch {
      /* private mode: theme stays for this tab */
    }
  }, [theme]);
  const change = (next: "light" | "dark") => {
    setTheme(next);
    void api("/me/preferences", { theme: next }).catch(() => undefined);
  };
  return [theme, change] as const;
}

function Shell({ logout }: { logout: () => void }) {
  const can = useCan();
  const { user } = useWorkspace();
  const location = useLocation();
  const [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [search, setSearch] = useState(false),
    [bell, setBell] = useState(false);
  const [theme, setTheme] = useTheme();
  const nav = useMemo(
    () =>
      NAV.map(
        ([g, items]) => [g, items.filter((i) => can(i.perm))] as const,
      ).filter(([, items]) => items.length),
    [can],
  );
  const counters = useQuery({
    queryKey: ["counters"],
    queryFn: () => api<{ tabs: Record<string, number> }>("/orders/counters"),
    refetchInterval: 45_000,
  });
  const unread = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: () =>
      api<NotificationList>("/notifications" + params({ limit: 8 })),
    refetchInterval: 45_000,
    enabled: can("notification.view"),
  });
  useEffect(() => {
    setMobile(false);
    setBell(false);
  }, [location.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setMobile(false);
        setBell(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const current = NAV.flatMap(([, i]) => i).find(
    (i) => i.path === (location.pathname.split("/")[1] ?? ""),
  );
  return (
    <div className={"app " + (collapsed ? "collapsed" : "")}>
      <a className="sr-only" href="#content">
        До основного вмісту
      </a>
      {mobile && (
        <div
          className="scrim"
          onClick={() => setMobile(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={"sidebar " + (mobile ? "open" : "")}
        aria-label="Головне меню"
      >
        <div className="row">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true">
              Р
            </span>
            <span>{t.brand}</span>
          </Link>
          <span className="spacer" />
          <button
            className="icon-btn mobile-only"
            aria-label="Закрити меню"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        {nav.map(([group, items]) => (
          <nav className="nav-group" key={group} aria-label={group}>
            <div className="nav-group-title">{group}</div>
            {items.map((i) => (
              <NavLink
                key={i.path}
                to={"/" + i.path}
                end={i.path === ""}
                className={({ isActive }) =>
                  "nav-link " + (isActive ? "active" : "")
                }
                title={collapsed ? i.name : undefined}
              >
                <i.icon size={18} aria-hidden="true" />
                <span>{i.name}</span>
                {i.path === "orders" &&
                  (counters.data?.tabs.confirmation ?? 0) > 0 && (
                    <b
                      className="nav-count"
                      aria-label="очікують підтвердження"
                    >
                      {counters.data?.tabs.confirmation}
                    </b>
                  )}
                {i.path === "notifications" &&
                  (unread.data?.unread ?? 0) > 0 && (
                    <b className="nav-count" aria-label="непрочитані">
                      {unread.data?.unread}
                    </b>
                  )}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="side-user">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{t.roles[user.role]}</small>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-only"
            aria-label="Відкрити меню"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <button
            className="icon-btn desktop-only"
            aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeftClose size={18} />
          </button>
          <nav className="crumbs" aria-label="Навігаційний ланцюжок">
            <span className="desktop-only">{t.workspace}</span>
            <span className="desktop-only" aria-hidden="true">
              /
            </span>
            <strong>{current?.name ?? t.workspace}</strong>
          </nav>
          <span className="spacer" />
          <button
            className="search-trigger"
            onClick={() => setSearch(true)}
            aria-label={t.search}
          >
            <Search size={16} aria-hidden="true" />
            <span>{t.search}</span>
            <kbd>⌘K</kbd>
          </button>
          <button
            className="icon-btn"
            aria-label={theme === "light" ? t.themeDark : t.themeLight}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {can("notification.view") && (
            <div className="anchor">
              <button
                className="icon-btn"
                aria-label={t.notifications}
                aria-expanded={bell}
                onClick={() => setBell((v) => !v)}
              >
                <Bell size={18} />
                {(unread.data?.unread ?? 0) > 0 && (
                  <span className="badge-dot">
                    {Math.min(99, unread.data?.unread ?? 0)}
                  </span>
                )}
              </button>
              {bell && (
                <div
                  className="popover"
                  role="dialog"
                  aria-label={t.notifications}
                >
                  <div className="panel-head">
                    <h2>{t.notifications}</h2>
                    <Link className="link" to="/notifications">
                      Усі
                    </Link>
                  </div>
                  {unread.data?.rows.length ? (
                    (unread.data.rows as Record<string, unknown>[]).map((n) => (
                      <Link
                        key={String(n.id)}
                        className="cmdk-item"
                        to={
                          n.entity === "order"
                            ? "/orders/" + String(n.entity_id)
                            : "/notifications"
                        }
                      >
                        <span>
                          {String(n.title)}
                          <small className="cell-sub">
                            {n.read ? "прочитано" : "нове"}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="panel-body muted">Нових сповіщень немає.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            className="icon-btn"
            aria-label={t.logout}
            title={t.logout}
            onClick={logout}
          >
            <LogOut size={18} />
          </button>
        </header>
        <main id="content" className="content" tabIndex={-1}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route
                path="/"
                element={can("dashboard.view") ? <Overview /> : <NoAccess />}
              />
              <Route path="/orders" element={<Orders />} />
              <Route
                path="/orders/new"
                element={can("order.create") ? <OrderCreate /> : <NoAccess />}
              />
              <Route path="/orders/:id" element={<OrderCard />} />
              <Route
                path="/customers"
                element={can("customer.view") ? <Customers /> : <NoAccess />}
              />
              <Route
                path="/customers/:id"
                element={can("customer.view") ? <CustomerCard /> : <NoAccess />}
              />
              <Route path="/tasks" element={<Tasks />} />
              <Route
                path="/analytics"
                element={can("report.view") ? <Analytics /> : <NoAccess />}
              />
              <Route
                path="/payments"
                element={can("payment.view") ? <Payments /> : <NoAccess />}
              />
              <Route
                path="/payments/:id"
                element={can("payment.view") ? <PaymentCard /> : <NoAccess />}
              />
              <Route
                path="/returns"
                element={can("return.view") ? <Returns /> : <NoAccess />}
              />
              <Route
                path="/returns/:id"
                element={can("return.view") ? <ReturnCard /> : <NoAccess />}
              />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductCard />} />
              <Route
                path="/suppliers"
                element={can("supplier.view") ? <Suppliers /> : <NoAccess />}
              />
              <Route
                path="/suppliers/:code"
                element={can("supplier.view") ? <SupplierCard /> : <NoAccess />}
              />
              <Route
                path="/delivery"
                element={can("shipment.view") ? <Delivery /> : <NoAccess />}
              />
              <Route
                path="/delivery/:id"
                element={can("shipment.view") ? <ShipmentCard /> : <NoAccess />}
              />
              <Route
                path="/staff"
                element={can("staff.manage") ? <Staff /> : <NoAccess />}
              />
              <Route
                path="/activity"
                element={can("audit.view") ? <Activity /> : <NoAccess />}
              />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>{t.notFound}</h1>
                    <Link className="btn" to="/">
                      {t.nav.overview}
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer className="footer">
          <span>РУБІЖ CRM · дані SITE та PIM</span>
          <span>Час — Київ</span>
        </footer>
      </div>
      {search && <CommandSearch onClose={() => setSearch(false)} />}
    </div>
  );
}
function NoAccess() {
  return (
    <div className="empty">
      <h1>{t.noAccess}</h1>
      <Link className="btn" to="/orders">
        {t.nav.orders}
      </Link>
    </div>
  );
}

/** ⌘K / Ctrl+K: orders (number, phone, name, email, TTN, SKU), customers, parcels, products — filtered by the server per role. */
function CommandSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState(""),
    [active, setActive] = useState(0);
  const q = useDebounce(input, 250);
  const result = useQuery({
    queryKey: ["search", q],
    queryFn: ({ signal }) =>
      api<SearchResult>("/search" + params({ q }), undefined, { signal }),
    enabled: q.trim().length >= 2,
  });
  type Hit = {
    id: string;
    group: string;
    label: string;
    detail: string;
    path: string;
  };
  const rows = (k: keyof SearchResult) =>
    (result.data?.[k] ?? []) as Record<string, unknown>[];
  const hits: Hit[] = [
    ...rows("orders").map((o) => ({
      id: "o" + o.id,
      group: t.nav.orders,
      label: String(o.number),
      detail: String(o.customer ?? ""),
      path: "/orders/" + o.id,
    })),
    ...rows("customers").map((c) => ({
      id: "c" + c.id,
      group: t.nav.customers,
      label: String(c.name || c.email || ""),
      detail: String(c.phone_masked ?? ""),
      path: "/customers/" + encodeURIComponent(String(c.id)),
    })),
    ...rows("shipments").map((s) => ({
      id: "s" + s.id,
      group: t.nav.delivery,
      label: String(s.tracking_number ?? "Чернетка"),
      detail: String(s.order_number ?? ""),
      path: "/delivery/" + s.id,
    })),
    ...rows("products").map((p) => ({
      id: "p" + p.id,
      group: t.nav.products,
      label: String(p.name),
      detail: String(p.skus) + " SKU",
      path: "/products/" + encodeURIComponent(String(p.id)),
    })),
  ];
  useEffect(() => setActive(0), [q]);
  const go = (p: string) => {
    navigate(p);
    onClose();
  };
  return (
    <Dialog title={t.search} onClose={onClose} wide>
      <div className="cmdk">
        <input
          aria-label={t.search}
          placeholder={t.searchHint}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          data-autofocus
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="cmdk-results"
          aria-activedescendant={
            hits[active] ? "hit-" + hits[active].id : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((v) => Math.min(v + 1, hits.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter" && hits[active]) go(hits[active].path);
          }}
        />
        <div id="cmdk-results" role="listbox" aria-label="Результати пошуку">
          {q.trim().length < 2 ? (
            <p className="panel-body muted">Введіть щонайменше 2 символи.</p>
          ) : result.isFetching ? (
            <Loading />
          ) : result.isError ? (
            <ErrorBox error={result.error} />
          ) : !hits.length ? (
            <p className="panel-body muted">{t.empty}</p>
          ) : (
            hits.map((h, i) => (
              <div key={h.id}>
                {(i === 0 || hits[i - 1].group !== h.group) && (
                  <div className="cmdk-group">{h.group}</div>
                )}
                <button
                  id={"hit-" + h.id}
                  role="option"
                  aria-selected={i === active}
                  className={"cmdk-item " + (i === active ? "active" : "")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h.path)}
                >
                  <span>
                    {h.label}
                    <small className="cell-sub">{h.detail}</small>
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
