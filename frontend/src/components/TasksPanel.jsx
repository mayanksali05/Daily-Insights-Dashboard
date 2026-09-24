import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CheckSquare, Circle, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { formatDue, todayStr } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

const PRIORITY = {
  high: { label: "High", cls: "bg-rose-500/15 text-rose-300", weight: 0 },
  medium: { label: "Medium", cls: "bg-amber-500/15 text-amber-300", weight: 1 },
  low: { label: "Low", cls: "bg-sky-500/15 text-sky-300", weight: 2 },
};

const byPriorityThenDue = (a, b) =>
  PRIORITY[a.priority].weight - PRIORITY[b.priority].weight ||
  (a.due_date || "9999").localeCompare(b.due_date || "9999");

function TaskForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [due, setDue] = useState(initial?.due_date || "");

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), priority, due_date: due || null });
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <input
        autoFocus
        className="input"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <input type="date" className="input !w-auto" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {initial ? "Save" : "Add task"}
          </button>
        </div>
      </div>
    </form>
  );
}

function TaskRow({ task, today, onToggle, onEdit, onDelete }) {
  const overdue = !task.completed && task.due_date && task.due_date < today;
  const p = PRIORITY[task.priority];
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        overdue ? "border-rose-500/40 bg-rose-500/5" : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <button onClick={onToggle} aria-label={task.completed ? "Mark not done" : "Mark done"} className="shrink-0">
        {task.completed ? (
          <CheckCircle2 size={20} className="text-emerald-400" />
        ) : (
          <Circle size={20} className="text-slate-500 hover:text-slate-300" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${task.completed ? "text-slate-500 line-through" : "text-slate-100"}`}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-md px-1.5 py-0.5 font-medium ${p.cls}`}>{p.label}</span>
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? "font-medium text-rose-400" : "text-slate-500"}`}>
              {overdue && <AlertTriangle size={12} />}
              {overdue ? "Overdue · " : "Due "}
              {formatDue(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <button className="icon-btn" onClick={onEdit} aria-label="Edit task">
        <Pencil size={15} />
      </button>
      <button className="icon-btn hover:!text-rose-400" onClick={onDelete} aria-label="Delete task">
        <Trash2 size={15} />
      </button>
    </li>
  );
}

export default function TasksPanel() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("today");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const today = todayStr();

  const load = () =>
    api
      .listTasks()
      .then((t) => {
        setTasks(t);
        setError(null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const open = (tasks || []).filter((t) => !t.completed);
  const groups = {
    overdue: open.filter((t) => t.due_date && t.due_date < today).sort(byPriorityThenDue),
    today: open.filter((t) => t.due_date === today).sort(byPriorityThenDue),
    upcoming: open.filter((t) => !t.due_date || t.due_date > today).sort(byPriorityThenDue),
    completed: (tasks || []).filter((t) => t.completed),
  };
  const visible = tab === "today" ? [...groups.overdue, ...groups.today] : groups[tab];
  const TABS = [
    ["today", "Today", groups.overdue.length + groups.today.length],
    ["upcoming", "Upcoming", groups.upcoming.length],
    ["completed", "Completed", groups.completed.length],
  ];
  const emptyText = { today: "Nothing due today. Nice.", upcoming: "No upcoming tasks.", completed: "No completed tasks yet." };

  return (
    <section className="card">
      <SectionTitle
        icon={CheckSquare}
        title="Tasks"
        right={
          !adding && (
            <button className="btn-primary !py-1.5" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add
            </button>
          )
        }
      />

      {groups.overdue.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          <AlertTriangle size={16} /> {groups.overdue.length} overdue task{groups.overdue.length > 1 ? "s" : ""}
        </div>
      )}

      {adding && (
        <div className="mb-3">
          <TaskForm
            onCancel={() => setAdding(false)}
            onSave={(body) => run(() => api.createTask(body)).then(() => setAdding(false))}
          />
        </div>
      )}

      <div className="mb-3 flex gap-1 rounded-xl bg-slate-950/60 p-1">
        {TABS.map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium ${
              tab === key ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label} <span className="text-xs text-slate-500">{count}</span>
          </button>
        ))}
      </div>

      {error && <ErrorNote message="Couldn't reach the tasks API." onRetry={load} />}
      {!tasks && !error && <Loading />}
      {tasks && visible.length === 0 && <p className="py-4 text-center text-sm text-slate-500">{emptyText[tab]}</p>}

      <ul className="space-y-2">
        {visible.map((t) =>
          editingId === t.id ? (
            <li key={t.id}>
              <TaskForm
                initial={t}
                onCancel={() => setEditingId(null)}
                onSave={(body) =>
                  run(() =>
                    api.updateTask(t.id, {
                      title: body.title,
                      priority: body.priority,
                      ...(body.due_date ? { due_date: body.due_date } : { clear_due_date: true }),
                    })
                  ).then(() => setEditingId(null))
                }
              />
            </li>
          ) : (
            <TaskRow
              key={t.id}
              task={t}
              today={today}
              onToggle={() => run(() => api.updateTask(t.id, { completed: !t.completed }))}
              onEdit={() => setEditingId(t.id)}
              onDelete={() => run(() => api.deleteTask(t.id))}
            />
          )
        )}
      </ul>
    </section>
  );
}
