import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, Loader2, Monitor, Moon, Palette, Save, Shield, Sun, UserRound, Users, Wifi } from "lucide-react";
import { AgentsManager } from "@/components/AgentsManager";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/theme-provider";
import { AzLogo } from "@/components/AzLogo";
import { parseAgentSettings, type AgentSettings } from "@/lib/agent-settings";
import { testAgentConnection } from "@/lib/agent.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "الإعدادات — AzCodex" },
    { name: "description", content: "إدارة حسابك ومظهر AzCodex وتفضيلات اتصال الوكيل الذكي." },
    { property: "og:title", content: "الإعدادات — AzCodex" },
    { property: "og:description", content: "إدارة الحساب والمظهر واتصال الوكيل الذكي في AzCodex." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { tab?: string } => (typeof s["tab"] === "string" ? { tab: s["tab"] } : {}),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const { tab } = Route.useSearch();
  const { theme, setTheme } = useTheme();
  const checkConnection = useServerFn(testAgentConnection);
  const [name, setName] = useState<string>(typeof user.user_metadata["full_name"] === "string" ? user.user_metadata["full_name"] : "");
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [settings, setSettings] = useState(() => parseAgentSettings(user.user_metadata["agent_settings"]));
  const [saving, setSaving] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<{ ok: boolean; message: string } | null>(null);

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); setSaving("account");
    try {
      const changedEmail = email.trim() !== user.email;
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() }, ...(changedEmail ? { email: email.trim() } : {}),
      }, { emailRedirectTo: window.location.origin });
      if (error) throw error;
      toast.success(changedEmail ? "تم حفظ الاسم؛ تحقق من البريد لتأكيد تغييره." : "تم حفظ بيانات الحساب.");
    } catch { toast.error("تعذر حفظ بيانات الحساب؛ حاول مجدداً."); }
    finally { setSaving(null); }
  }
  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { toast.error("كلمتا المرور غير متطابقتين."); return; }
    setSaving("password");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirm(""); toast.success("تم تغيير كلمة المرور.");
    } catch { toast.error("تعذر تغيير كلمة المرور؛ قد تحتاج إلى تسجيل الدخول مجدداً."); }
    finally { setSaving(null); }
  }
  async function saveAgent(event: FormEvent) {
    event.preventDefault(); setSaving("agent");
    try {
      const { error } = await supabase.auth.updateUser({ data: { agent_settings: settings } });
      if (error) throw error;
      toast.success("تم حفظ إعدادات الوكيل.");
    } catch { toast.error("تعذر حفظ إعدادات الوكيل."); }
    finally { setSaving(null); }
  }
  async function testConnection() {
    setChecking(true); setConnection(null);
    try { setConnection(await checkConnection()); }
    catch { setConnection({ ok: false, message: "تعذر اختبار الاتصال؛ حاول مجدداً." }); }
    finally { setChecking(false); }
  }
  function patchSettings(patch: Partial<AgentSettings>) { setSettings((current) => ({ ...current, ...patch })); }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/chat" className="flex items-center gap-2"><AzLogo /><span className="font-mono font-semibold">AzCodex</span></Link>
          <Button asChild variant="ghost" size="sm"><Link to="/chat"><ArrowRight /> العودة للمحادثات</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-9">
        <h1 className="text-3xl font-semibold">الإعدادات</h1>
        <nav className="mt-5 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/github">GitHub</Link></Button><Button asChild variant="outline"><Link to="/frappe">Frappe / ERPNext</Link></Button></nav>
        <Tabs defaultValue={tab ?? "account"} dir="rtl" className="mt-8">
          <TabsList className="mb-7 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1 sm:w-fit">
            <TabsTrigger value="account" className="gap-2"><UserRound className="size-4" /> الحساب</TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2"><Palette className="size-4" /> المظهر</TabsTrigger>
            <TabsTrigger value="agent" className="gap-2"><Bot className="size-4" /> الوكيل</TabsTrigger>
            <TabsTrigger value="agents" className="gap-2"><Users className="size-4" /> الوكلاء</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="size-4" /> الأمان</TabsTrigger>
          </TabsList>
          <TabsContent value="agents" className="max-w-2xl">
            <h2 className="mb-4 text-xl font-semibold">الوكلاء المتعددون</h2>
            <AgentsManager initial={user.user_metadata["agents"]} />
          </TabsContent>
          <TabsContent value="account" className="max-w-2xl">
            <h2 className="mb-6 text-xl font-semibold">الملف الشخصي</h2>
            <div className="mb-7 flex items-center gap-4 border-b border-border pb-6">
              <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-brand-text">{(name || user.email || "A").slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0"><p className="break-words font-medium">{name || "حسابي"}</p><p dir="ltr" className="break-all text-sm text-muted-foreground">{user.email}</p></div>
            </div>
            <form onSubmit={saveAccount} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="full-name">الاسم</Label><Input id="full-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
              <div className="space-y-2"><Label htmlFor="account-email">البريد الإلكتروني</Label><Input id="account-email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
              <Button disabled={saving !== null} type="submit"><Save />{saving === "account" ? "جارٍ الحفظ…" : "حفظ بيانات الحساب"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="appearance" className="max-w-2xl">
            <h2 className="mb-6 text-xl font-semibold">مظهر التطبيق</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="مظهر التطبيق">
              {([{ value: "light", label: "نهاري", icon: Sun }, { value: "dark", label: "ليلي", icon: Moon }, { value: "system", label: "تلقائي", icon: Monitor }] as const).map((option) => (
                <Button key={option.value} variant="outline" aria-pressed={theme === option.value} onClick={() => setTheme(option.value)} className={`h-28 flex-col gap-3 ${theme === option.value ? "border-primary bg-primary/10 text-brand-text" : ""}`}><option.icon className="size-6" />{option.label}</Button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="agent" className="max-w-2xl">
            <h2 className="mb-6 text-xl font-semibold">اتصال الوكيل</h2>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
              <div><p className="font-medium">Lovable AI</p><p className="mt-1 font-mono text-sm text-muted-foreground">gpt-6-astra</p></div>
              <Button variant="outline" onClick={testConnection} disabled={checking}>{checking ? <Loader2 className="animate-spin" /> : <Wifi />}{checking ? "جارٍ الاتصال…" : "اختبار الاتصال"}</Button>
            </div>
            <div aria-live="polite">{connection && <p className={`mb-6 flex items-start gap-2 text-sm ${connection.ok ? "text-brand-text" : "text-destructive"}`}>{connection.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <CircleAlert className="size-4 shrink-0" />}{connection.message}</p>}</div>
            <form onSubmit={saveAgent} className="space-y-6">
              <div className="flex items-center justify-between gap-4"><Label htmlFor="agent-enabled">تفعيل اتصال الوكيل</Label><Switch id="agent-enabled" checked={settings.enabled} onCheckedChange={(enabled) => patchSettings({ enabled })} /></div>
              <div className="space-y-2"><Label htmlFor="agent-language">لغة الردود</Label><Select dir="rtl" value={settings.language} onValueChange={(value) => patchSettings({ language: value as AgentSettings["language"] })}><SelectTrigger id="agent-language"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">لغة المحادثة</SelectItem><SelectItem value="ar">العربية</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="agent-style">تفصيل الردود</Label><Select dir="rtl" value={settings.style} onValueChange={(value) => patchSettings({ style: value as AgentSettings["style"] })}><SelectTrigger id="agent-style"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="balanced">متوازن</SelectItem><SelectItem value="concise">مختصر</SelectItem><SelectItem value="detailed">تفصيلي</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="agent-instructions">تعليمات مخصصة</Label><Textarea id="agent-instructions" rows={5} maxLength={2000} value={settings.instructions} onChange={(e) => patchSettings({ instructions: e.target.value })} /><p dir="ltr" className="text-left text-xs text-muted-foreground">{settings.instructions.length} / 2000</p></div>
              <Button type="submit" disabled={saving !== null}><Save />{saving === "agent" ? "جارٍ الحفظ…" : "حفظ إعدادات الوكيل"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="security" className="max-w-2xl">
            <h2 className="mb-6 text-xl font-semibold">تغيير كلمة المرور</h2>
            <form onSubmit={savePassword} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة</Label><Input id="new-password" type="password" dir="ltr" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="confirm-password">تأكيد كلمة المرور</Label><Input id="confirm-password" type="password" dir="ltr" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              <Button type="submit" disabled={saving !== null}><Shield />{saving === "password" ? "جارٍ التغيير…" : "تغيير كلمة المرور"}</Button>
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}