import { useState } from "react";
import { Plus, Save, Trash2, RefreshCw, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGENT_MODELS,
  MAX_AGENTS,
  agentsSchema,
  agentModelLabel,
  parseAgents,
  type AgentModel,
  type AgentProfile,
} from "@/lib/agents";

import { getOllamaModels, testOllamaConnection } from "@/lib/ollama.functions";

export function AgentsManager({ initial }: { initial: unknown }) {
  const qc = useQueryClient();
  const [config, setConfig] = useState(() => parseAgents(initial));
  const [saving, setSaving] = useState(false);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>(
    {},
  );
  const ollama = useQuery({
    queryKey: ["ollama-models"],
    queryFn: () => getOllamaModels(),
    enabled: false,
    retry: false,
  });
  const ollamaModels = ollama.data?.ok ? ollama.data.models : [];
  async function testModel(model: AgentModel) {
    if (!model.startsWith("ollama/")) return;
    setTestingModel(model);
    setTestResults((current) => {
      const next = { ...current };
      delete next[model];
      return next;
    });
    try {
      const result = await testOllamaConnection({ data: model as `ollama/${string}` });
      setTestResults((current) => ({ ...current, [model]: result }));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch {
      const message = "تعذر اختبار الاتصال؛ تحقق من جلستك وحاول مجددًا.";
      setTestResults((current) => ({ ...current, [model]: { ok: false, message } }));
      toast.error(message);
    } finally {
      setTestingModel(null);
    }
  }
  const patch = (id: string, p: Partial<AgentProfile>) =>
    setConfig((c) => ({ ...c, list: c.list.map((a) => (a.id === id ? { ...a, ...p } : a)) }));
  const add = () =>
    setConfig((c) => ({
      ...c,
      list: [
        ...c.list,
        {
          id: `agent-${Date.now().toString(36)}`,
          name: "وكيل جديد",
          model: "openai/gpt-6-astra",
          instructions: "",
          benchTools: false,
        },
      ],
    }));
  const remove = (id: string) =>
    setConfig((c) => {
      const list = c.list.filter((a) => a.id !== id);
      return { list, activeId: c.activeId === id ? list[0]!.id : c.activeId };
    });
  async function save() {
    const parsed = agentsSchema.safeParse(config);
    if (!parsed.success) {
      toast.error("راجع أسماء الوكلاء والنماذج والتعليمات قبل الحفظ.");
      return;
    }
    setSaving(true);
    try {
      const next = parseAgents(parsed.data);
      const { error } = await supabase.auth.updateUser({ data: { agents: next } });
      if (error) {
        toast.error("تعذر حفظ الوكلاء.");
        return;
      }
      setConfig(next);
      qc.setQueryData(["agents"], next);
      toast.success("تم حفظ الوكلاء.");
    } catch {
      toast.error("تعذر حفظ الوكلاء؛ حاول مجددًا.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        أنشئ وكلاء بأدوار ونماذج مختلفة، ثم بدّل بينهم من قائمة الوكيل أسفل مربع الكتابة في
        المحادثة.
      </p>
      <details className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <summary className="cursor-pointer font-medium">
          توجيهات ربط Microsoft Foundry (حساب Entra وصلاحية Azure AI User)
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pe-1 ps-5 leading-relaxed">
          <li>
            افتح{" "}
            <span dir="ltr" className="font-mono">
              portal.azure.com
            </span>{" "}
            ← Microsoft Entra ID ← App registrations ← New registration، وسمِّ التطبيق مثلاً{" "}
            <span dir="ltr" className="font-mono">
              az-codex
            </span>
            .
          </li>
          <li>
            من صفحة «Overview» انسخ <b>Directory (tenant) ID</b> و<b>Application (client) ID</b>.
          </li>
          <li>
            من «Certificates &amp; secrets» ← New client secret، أنشئ مفتاحاً وانسخ قيمته (Value)
            فوراً لأنها لا تظهر مرة أخرى.
          </li>
          <li>
            افتح مورد{" "}
            <span dir="ltr" className="font-mono">
              az-ai-resource
            </span>{" "}
            ثم مشروع{" "}
            <span dir="ltr" className="font-mono">
              az-ai-gateway
            </span>{" "}
            ← Access control (IAM) ← Add role assignment.
          </li>
          <li>
            اختر الدور <b>Azure AI User</b>، ثم Members ← User, group, or service principal، وابحث
            عن تطبيق{" "}
            <span dir="ltr" className="font-mono">
              az-codex
            </span>{" "}
            واحفظ.
          </li>
          <li>
            انتظر بضع دقائق حتى تُفعَّل الصلاحية، وتأكد أن الوكيل{" "}
            <span dir="ltr" className="font-mono">
              az-agent-copilot
            </span>{" "}
            منشور في المشروع.
          </li>
          <li>
            أدخل القيم الثلاث في إعدادات المشروع السرية بالأسماء:{" "}
            <span dir="ltr" className="font-mono">
              AZURE_TENANT_ID
            </span>
            ،{" "}
            <span dir="ltr" className="font-mono">
              AZURE_CLIENT_ID
            </span>
            ،{" "}
            <span dir="ltr" className="font-mono">
              AZURE_CLIENT_SECRET
            </span>
            . لا تلصقها في المحادثة.
          </li>
          <li>
            اختر لوكيلك النموذج «Microsoft Foundry» واحفظ، ثم أرسل رسالة تجريبية. إن ظهر رفض
            (401/403) فالصلاحية لم تُفعَّل بعد أو أُسندت لمورد خاطئ.
          </li>
        </ol>
      </details>
      <section aria-label="اتصال Ollama" className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-medium">Ollama — النماذج المحلية</h3>
        <p className="text-sm text-muted-foreground">
          اجلب النماذج من خدمة Ollama، ثم اختر أحدها لأي وكيل أدناه. النماذج الحالية تبقى متاحة.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={ollama.isFetching}
          onClick={() => void ollama.refetch()}
        >
          <RefreshCw className={ollama.isFetching ? "animate-spin" : ""} />
          {ollama.isFetching ? "جارٍ الاتصال…" : "جلب / تحديث نماذج Ollama"}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {ollama.isError
            ? "تعذر جلب النماذج؛ تحقق من جلستك وحاول مجددًا."
            : ollama.data
              ? ollama.data.ok
                ? ollamaModels.length
                  ? `تم العثور على ${ollamaModels.length} نموذج. اختر النموذج ثم اختبر الاتصال واحفظ الوكلاء.`
                  : "الخدمة متصلة ولا توجد نماذج مثبتة. ثبّت نموذجًا في Ollama ثم حدّث القائمة."
                : ollama.data.message
              : "لم يُفحص الاتصال بعد."}
        </p>
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">إعداد الاتصال</summary>
          <p className="mt-2">
            يضبط مسؤول التشغيل عنوان الخدمة على خادم التطبيق. إذا كان Ollama على جهاز آخر، يجب أن
            يستطيع خادم التطبيق الوصول إليه. الصور والأدوات متاحة حسب قدرات النموذج.
          </p>
        </details>
      </section>
      {config.list.map((a) => (
        <div key={a.id} className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Input
              aria-label="اسم الوكيل"
              value={a.name}
              maxLength={40}
              onChange={(e) => patch(a.id, { name: e.target.value })}
            />
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="radio"
                name="default-agent"
                checked={config.activeId === a.id}
                onChange={() => setConfig((c) => ({ ...c, activeId: a.id }))}
              />
              افتراضي
            </label>
            <Button
              variant="ghost"
              size="icon"
              aria-label="حذف الوكيل"
              disabled={config.list.length <= 1}
              onClick={() => remove(a.id)}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="space-y-2">
            <Label>النموذج</Label>
            <Select
              dir="rtl"
              value={a.model}
              onValueChange={(v) => patch(a.id, { model: v as AgentModel })}
            >
              <SelectTrigger aria-label={`نموذج ${a.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                {a.model.startsWith("ollama/") &&
                  !ollamaModels.some((model) => model.id === a.model) && (
                    <SelectItem value={a.model}>
                      {agentModelLabel(a.model)} (محفوظ؛ حدّث القائمة للتحقق)
                    </SelectItem>
                  )}
                {ollamaModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    Ollama · {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {a.model.startsWith("ollama/") && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={testingModel !== null}
                onClick={() => void testModel(a.model)}
              >
                <PlugZap />
                {testingModel === a.model ? "جارٍ اختبار النموذج…" : "اختبار اتصال Ollama"}
              </Button>
              <p
                role="status"
                aria-live="polite"
                className={`text-sm ${testResults[a.model]?.ok === false ? "text-destructive" : "text-muted-foreground"}`}
              >
                {testingModel === a.model
                  ? "يجري اختبار توليد رد فعلي؛ قد يستغرق تحميل النموذج على المعالج عدة دقائق."
                  : testResults[a.model]?.message}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>دور الوكيل وتعليماته</Label>
            <Textarea
              rows={3}
              maxLength={2000}
              value={a.instructions}
              onChange={(e) => patch(a.id, { instructions: e.target.value })}
              placeholder="مثال: أنت مراجع كود صارم لتطبيقات Frappe."
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label>السماح بأدوات البنش (على السيرفر فقط)</Label>
            <Switch
              checked={a.benchTools}
              onCheckedChange={(benchTools) => patch(a.id, { benchTools })}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={add} disabled={config.list.length >= MAX_AGENTS}>
          <Plus />
          إضافة وكيل
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save />
          {saving ? "جارٍ الحفظ…" : "حفظ الوكلاء"}
        </Button>
      </div>
    </div>
  );
}
