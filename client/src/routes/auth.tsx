import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AzLogo } from "@/components/AzLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — AzCodex" },
      { name: "description", content: "سجّل الدخول إلى مساحة عمل AzCodex." },
      { property: "og:title", content: "تسجيل الدخول — AzCodex" },
      { property: "og:description", content: "سجّل الدخول إلى مساحة عمل AzCodex." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/chat" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. تحقق من بريدك لتأكيده.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("تعذر تسجيل الدخول عبر Google"); return; }
    if (r.redirected) return;
    navigate({ to: "/chat" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-grid px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-glow">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AzLogo size={44} />
          <h1 className="text-xl font-semibold">{mode === "in" ? "مرحباً بعودتك" : "إنشاء حساب"}</h1>
          <p className="text-sm text-muted-foreground">مساحة عمل AzCodex الذكية</p>
        </div>
        <Button variant="outline" className="w-full" onClick={google}>
          المتابعة باستخدام Google
        </Button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> أو <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" required placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          <Input type="password" required minLength={6} placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "in" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </Button>
        </form>
        <button
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "in" ? "ليس لديك حساب؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </div>
  );
}
