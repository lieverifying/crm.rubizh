import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type {
  AssigneeList,
  AuditList,
  NotificationList,
  TaskList,
} from "./contract.gen";
import { api, date, params, useCan, useWorkspace } from "./lib";
import {
  ActionDialog,
  Empty,
  ErrorBox,
  Loading,
  PageHead,
  Pager,
  Panel,
  Pill,
  Tabs,
} from "./kit";
import { ActivityList, actionText } from "./overview";
import { t } from "./i18n";

type Task = {
  id: number;
  title: string;
  body: string;
  state: string;
  due_at: string | null;
  order_id: number | null;
  order_number?: string | null;
  assignee_name?: string | null;
  auto_key: string | null;
  version: number;
};
export function Tasks() {
  const can = useCan();
  const client = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const view = sp.get("view") ?? "mine";
  const list = useQuery({
    queryKey: ["tasks", view, sp.get("page")],
    queryFn: () =>
      api<TaskList>(
        "/tasks" + params({ view, page: sp.get("page") ?? "1", limit: 25 }),
      ),
  });
  const people = useQuery({
    queryKey: ["assignees"],
    queryFn: () => api<AssigneeList>("/staff/assignees"),
    enabled: can("staff.assignees"),
  });
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [due, setDue] = useState(""),
    [who, setWho] = useState("");
  const move = async (tk: Task, state: string) => {
    await api("/tasks/" + tk.id, { state, version: tk.version });
    void client.invalidateQueries({ queryKey: ["tasks"] });
  };
  return (
    <>
      <PageHead
        title={t.nav.tasks}
        text="Завдання команди. Автозавдання: замовлення без підтвердження, оплачене без ТТН."
        actions={
          can("task.manage") ? (
            <button className="btn primary" onClick={() => setOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Нове завдання
            </button>
          ) : undefined
        }
      />
      <Panel>
        <Tabs
          items={[
            ["mine", "Мої"],
            ["all", "Усі"],
            ["overdue", "Прострочені"],
            ["done", "Виконані"],
          ]}
          value={view}
          onChange={(v) => setSp({ view: v })}
        />
        {list.isPending ? (
          <Loading rows={4} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty title="Завдань немає" text="" />
        ) : (
          <>
            {(list.data.rows as Task[]).map((tk) => (
              <div className="mcard" key={tk.id}>
                <div className="mcard-top">
                  <strong>{tk.title}</strong>
                  <Pill code={tk.state}>{t.taskState[tk.state]}</Pill>
                </div>
                <span className="sub">
                  {tk.due_at ? "до " + date(tk.due_at, true) : "без строку"}
                  {tk.assignee_name ? " · " + tk.assignee_name : ""}
                  {tk.auto_key ? " · автоматично" : ""}
                  {tk.order_id ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link className="link" to={"/orders/" + tk.order_id}>
                        {tk.order_number ?? "замовлення"}
                      </Link>
                    </>
                  ) : null}
                </span>
                {can("task.manage") &&
                  tk.state !== "DONE" &&
                  tk.state !== "CANCELLED" && (
                    <div className="row">
                      {tk.state === "OPEN" && (
                        <button
                          className="btn small"
                          onClick={() => void move(tk, "IN_PROGRESS")}
                        >
                          Взяти в роботу
                        </button>
                      )}
                      <button
                        className="btn small"
                        onClick={() => void move(tk, "DONE")}
                      >
                        Виконано
                      </button>
                      <button
                        className="btn small ghost"
                        onClick={() => void move(tk, "CANCELLED")}
                      >
                        Скасувати
                      </button>
                    </div>
                  )}
              </div>
            ))}
            <Pager
              page={list.data.pagination}
              onChange={(n) => setSp({ view, page: String(n) })}
            />
          </>
        )}
      </Panel>
      {open && (
        <ActionDialog
          title="Нове завдання"
          onClose={() => setOpen(false)}
          submitText={t.save}
          onSubmit={async ({ key }) => {
            await api(
              "/tasks",
              {
                title: title.trim(),
                ...(due ? { due_at: due } : {}),
                ...(who ? { assignee_id: who } : {}),
              },
              { idem: key },
            );
            setTitle("");
            void client.invalidateQueries({ queryKey: ["tasks"] });
          }}
        >
          <label className="field">
            Що зробити
            <input
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Строк
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          {can("staff.assignees") && (
            <label className="field">
              Виконавець
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Я</option>
                {(
                  people.data?.rows as
                    | { id: string; name: string }[]
                    | undefined
                )?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </ActionDialog>
      )}
    </>
  );
}

type Note = {
  id: number;
  kind: string;
  entity: string;
  entity_id: string;
  title: string;
  critical: boolean;
  read: boolean;
  created_at: string;
};
export function Notifications() {
  const client = useQueryClient();
  const { notify } = useWorkspace();
  const [view, setView] = useState("all");
  const list = useQuery({
    queryKey: ["notifications", view],
    queryFn: () =>
      api<NotificationList>(
        "/notifications" +
          params({ view: view === "unread" ? "unread" : "", limit: 50 }),
      ),
    refetchInterval: 45_000,
  });
  const readAll = async () => {
    await api("/notifications/read", { all: true });
    notify(t.done);
    void client.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <>
      <PageHead
        title={t.nav.notifications}
        text="Нові замовлення, оплати, затримки, повернення, завдання та критичні події."
        actions={
          <button className="btn" onClick={() => void readAll()}>
            Позначити все прочитаним
          </button>
        }
      />
      <Panel>
        <Tabs
          items={[
            ["all", "Усі"],
            ["unread", "Непрочитані"],
          ]}
          value={view}
          onChange={setView}
          counts={{ unread: list.data?.unread ?? 0 }}
        />
        {list.isPending ? (
          <Loading rows={4} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.rows.length ? (
          <Empty title="Сповіщень немає" text="" />
        ) : (
          (list.data.rows as Note[]).map((n) => (
            <Link
              key={n.id}
              className="mcard"
              to={
                n.entity === "order"
                  ? "/orders/" + n.entity_id
                  : n.entity === "task"
                    ? "/tasks"
                    : n.entity === "return"
                      ? "/returns/" + n.entity_id
                      : "/notifications"
              }
              onClick={() =>
                void api("/notifications/read", { ids: [n.id] }).then(() =>
                  client.invalidateQueries({ queryKey: ["notifications"] }),
                )
              }
            >
              <div className="mcard-top">
                <strong>{n.title}</strong>
                {n.critical ? (
                  <Pill code="FAILED">критично</Pill>
                ) : !n.read ? (
                  <Pill code="AWAITING">нове</Pill>
                ) : null}
              </div>
              <span className="sub">{date(n.created_at, true)}</span>
            </Link>
          ))
        )}
      </Panel>
    </>
  );
}

/** Activity: append-only audit, read-only; the server limits MANAGER to own orders and ACCOUNTANT to payments. */
export function Activity() {
  const [sp, setSp] = useSearchParams();
  const list = useQuery({
    queryKey: ["audit", sp.toString()],
    queryFn: () =>
      api<AuditList>(
        "/audit" + params({ ...Object.fromEntries(sp), limit: 50 }),
      ),
  });
  return (
    <>
      <PageHead
        title={t.nav.activity}
        text="Журнал дій лише для читання: хто, коли, що змінив і чому."
      />
      <Panel>
        {list.isPending ? (
          <Loading rows={6} />
        ) : list.isError ? (
          <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <ActivityList
              rows={(
                list.data.rows as {
                  id: string;
                  actor: string | null;
                  action: string;
                  entity: string;
                  entity_id: string;
                  created_at: string;
                  reason: string;
                }[]
              ).map((r) => ({ ...r, action: r.action }))}
            />
            <Pager
              page={list.data.pagination}
              onChange={(n) =>
                setSp({ ...Object.fromEntries(sp), page: String(n) })
              }
            />
          </>
        )}
      </Panel>
      <span className="sr-only">{actionText("")}</span>
    </>
  );
}
