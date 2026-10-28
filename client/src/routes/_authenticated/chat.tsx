import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, LogOut, Pencil, Pin, PinOff, Plus, Search, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createThread, threadsQuery, type Thread } from "@/lib/threads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AzLogo } from "@/components/AzLogo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "المحادثات — AzCodex" },
      { name: "description", content: "مساحة محادثة AzCodex مع وكيل الذكاء الاصطناعي." },
      { property: "og:title", content: "المحادثات — AzCodex" },
      { property: "og:description", content: "مساحة محادثة AzCodex مع وكيل الذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatLayout,
});

function ChatLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const { data: threads = [] } = useQuery(threadsQuery);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const list = useMemo(
    () =>
      threads.filter(
        (t) => t.archived === showArchived && t.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [threads, q, showArchived],
  );

  async function onNew() {
    try {
      const id = await createThread();
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch {
      toast.error("تعذر إنشاء محادثة");
    }
  }

  async function rename() {
    if (!editing) return;
    const title = editing.title.trim().slice(0, 80);
    setEditing(null);
    if (!title) return;
    const { error } = await supabase.from("threads").update({ title }).eq("id", editing.id);
    if (error) { toast.error("تعذرت إعادة التسمية"); return; }
    qc.invalidateQueries({ queryKey: ["threads"] });
  }

  async function update(t: Thread, patch: Partial<Pick<Thread, "pinned" | "archived">>) {
    const { error } = await supabase.from("threads").update(patch).eq("id", t.id);
    if (error) { toast.error("تعذر التحديث"); return; }
    qc.invalidateQueries({ queryKey: ["threads"] });
  }

  async function remove(t: Thread) {
    const { error } = await supabase.from("threads").delete().eq("id", t.id);
    if (error) { toast.error("تعذر الحذف"); return; }
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (params.threadId === t.id) navigate({ to: "/chat" });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 py-4">
          <AzLogo />
          <span className="font-mono text-sm font-semibold tracking-wide">AzCodex</span>
        </div>
        <div className="space-y-2 px-3">
          <Button onClick={onNew} className="w-full justify-start gap-2">
            <Plus className="size-4" /> محادثة جديدة
          </Button>
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث في المحادثات"
              className="pr-8"
            />
          </div>
          <div className="flex gap-1 rounded-md bg-sidebar-accent p-1 text-xs">
            {[false, true].map((a) => (
              <button
                key={String(a)}
                onClick={() => setShowArchived(a)}
                className={cn(
                  "flex-1 rounded px-2 py-1 transition-colors",
                  showArchived === a ? "bg-background text-foreground" : "text-muted-foreground",
                )}
              >
                {a ? "المؤرشفة" : "النشطة"}
              </button>
            ))}
          </div>
        </div>
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {list.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد محادثات</p>
          )}
          {list.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent",
                params.threadId === t.id && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {editing?.id === t.id ? (
                <Input
                  autoFocus
                  value={editing.title}
                  onChange={(e) => setEditing({ id: t.id, title: e.target.value })}
                  onBlur={rename}
                  onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setEditing(null); }}
                  className="h-7 flex-1 text-sm"
                  aria-label="اسم المحادثة"
                />
              ) : (
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex min-w-0 flex-1 items-center gap-1.5"
              >
                {t.pinned && <Pin className="size-3 shrink-0 text-brand-text" />}
                <span className="truncate">{t.title}</span>
              </Link>
              )}
              <div className="hidden shrink-0 items-center group-hover:flex">
                <IconBtn label="إعادة تسمية" onClick={() => setEditing({ id: t.id, title: t.title })}>
                  <Pencil className="size-3.5" />
                </IconBtn>
                <IconBtn label={t.pinned ? "إلغاء التثبيت" : "تثبيت"} onClick={() => update(t, { pinned: !t.pinned })}>
                  {t.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                </IconBtn>
                <IconBtn label={t.archived ? "استعادة" : "أرشفة"} onClick={() => update(t, { archived: !t.archived })}>
                  {t.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                </IconBtn>
                <IconBtn label="حذف" onClick={() => { if (confirm("حذف هذه المحادثة نهائياً؟")) remove(t); }}>
                  <Trash2 className="size-3.5" />
                </IconBtn>
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button asChild variant="ghost" className="w-full justify-start gap-2">
            <Link to="/settings"><Settings className="size-4" /> الإعدادات</Link>
          </Button>
          <Button variant="ghost" onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="size-4" /> تسجيل الخروج
          </Button>
        </div>
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col bg-grid">
        <Outlet />
      </main>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
    >
      {children}
    </button>
  );
}
