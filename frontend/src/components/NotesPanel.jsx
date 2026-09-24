import { useEffect, useState } from "react";
import { Plus, StickyNote, Trash2 } from "lucide-react";
import { api } from "../api";
import { timeAgo } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

function useNotes() {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);
  const load = () =>
    api
      .listNotes()
      .then((n) => {
        setNotes(n);
        setError(null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return { notes, error, load };
}

/** Compact card for the dashboard: most recent notes, click to open in the editor. */
export function RecentNotes({ onOpen, className = "" }) {
  const { notes, error, load } = useNotes();
  return (
    <section className={`panel ${className}`}>
      <SectionTitle
        icon={StickyNote}
        title="Quick Notes"
        right={
          <button className="btn-ghost !py-1" onClick={() => onOpen("new")}>
            <Plus size={16} /> New
          </button>
        }
      />
      <div className="panel-body">
        {error && <ErrorNote message="Couldn't reach the notes API." onRetry={load} />}
        {!notes && !error && <Loading />}
        {notes?.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No notes yet.</p>}
        <ul className="space-y-2">
          {notes?.slice(0, 8).map((n) => (
            <li key={n.id}>
              <button
                onClick={() => onOpen(n.id)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 text-left hover:border-slate-600"
              >
                <p className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">{n.title || "Untitled"}</span>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(n.updated_at)}</span>
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{n.content || "Empty note"}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Editor({ note, onSaved, onDeleted }) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { title: title.trim(), content };
      const saved = note ? await api.updateNote(note.id, body) : await api.createNote(body);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteNote(note.id);
      onDeleted();
    } catch (e) {
      setError(e.message);
    }
  };

  const dirty = title !== (note?.title || "") || content !== (note?.content || "");

  return (
    <div className="flex h-full flex-col gap-3">
      <input
        className="input !text-base font-medium"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <textarea
        className="input min-h-[260px] flex-1 resize-y leading-relaxed"
        placeholder="Start writing…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={save} disabled={saving || (!dirty && !!note) || (!title.trim() && !content.trim())}>
          {saving ? "Saving…" : "Save"}
        </button>
        {note && (
          <>
            <button className="btn-ghost hover:!text-rose-300" onClick={remove}>
              <Trash2 size={15} /> Delete
            </button>
            <span className="ml-auto text-xs text-slate-500">Edited {timeAgo(note.updated_at)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Full notes page: list on the left, editor on the right. */
export default function NotesPage({ initialId }) {
  const { notes, error, load } = useNotes();
  const [selected, setSelected] = useState(initialId || null); // note id | "new" | null

  useEffect(() => {
    if (!selected && notes?.length) setSelected(notes[0].id);
  }, [notes, selected]);

  const current = notes?.find((n) => n.id === selected) || null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <section className="card">
        <SectionTitle
          icon={StickyNote}
          title="Notes"
          right={
            <button className="btn-primary !py-1.5" onClick={() => setSelected("new")}>
              <Plus size={16} /> New
            </button>
          }
        />
        {error && <ErrorNote message="Couldn't reach the notes API." onRetry={load} />}
        {!notes && !error && <Loading />}
        {notes?.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No notes yet.</p>}
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {notes?.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setSelected(n.id)}
                className={`w-full rounded-xl px-3 py-2 text-left ${
                  selected === n.id ? "bg-slate-800" : "hover:bg-slate-800"
                }`}
              >
                <p className="truncate text-sm font-medium text-slate-100">{n.title || "Untitled"}</p>
                <p className="truncate text-xs text-slate-500">{n.content || "Empty note"}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card min-h-[420px]">
        {selected === "new" || current ? (
          <Editor
            key={selected}
            note={selected === "new" ? null : current}
            onSaved={(saved) => load().then(() => setSelected(saved.id))}
            onDeleted={() => {
              setSelected(null);
              load();
            }}
          />
        ) : (
          <p className="py-16 text-center text-sm text-slate-500">Select a note or create a new one.</p>
        )}
      </section>
    </div>
  );
}
