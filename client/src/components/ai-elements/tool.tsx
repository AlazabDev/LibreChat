import { ChevronDown, Check, X, Loader2, ShieldAlert, Wrench } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  github_list_repos: "GitHub · المستودعات",
  github_read: "GitHub · قراءة ملف",
  github_commits: "GitHub · الالتزامات",
  frappe_list: "Frappe · السجلات",
  web_search: "بحث الويب",
  workspace_read_file: "البنش · قراءة ملف",
  workspace_list: "البنش · عرض مجلد",
  workspace_write_file: "البنش · تعديل ملف",
  workspace_run: "البنش · تنفيذ أمر",
};

export type ToolPartView = {
  name: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approvalId?: string;
};

const STATE: Record<string, { label: string; cls: string }> = {
  "input-streaming": { label: "يجهّز", cls: "text-muted-foreground" },
  "input-available": { label: "يعمل", cls: "text-brand-text" },
  "approval-requested": { label: "بانتظار موافقتك", cls: "text-chart-4" },
  "approval-responded": { label: "تم الرد", cls: "text-muted-foreground" },
  "output-available": { label: "اكتمل", cls: "text-chart-2" },
  "output-error": { label: "فشل", cls: "text-destructive" },
  "output-denied": { label: "مرفوض", cls: "text-destructive" },
};

function show(v: unknown) {
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

export function Tool({ part, onApprove }: { part: ToolPartView; onApprove?: (id: string, ok: boolean) => void }) {
  const s = STATE[part.state] ?? { label: part.state, cls: "text-muted-foreground" };
  const waiting = part.state === "approval-requested" && part.approvalId;
  const Icon = part.state === "input-available" ? Loader2 : waiting ? ShieldAlert : Wrench;
  return (
    <Collapsible defaultOpen={Boolean(waiting)} className="my-2 rounded-lg border border-border bg-card/40 text-sm">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2">
        <Icon className={cn("size-4", s.cls, part.state === "input-available" && "animate-spin")} />
        <span className="font-medium">{LABELS[part.name] ?? part.name}</span>
        <span className={cn("text-xs", s.cls)}>{s.label}</span>
        <ChevronDown className="ms-auto size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t border-border px-3 py-2">
        {part.input !== undefined && (
          <pre dir="ltr" className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{show(part.input)}</pre>
        )}
        {part.output !== undefined && (
          <pre dir="ltr" className="max-h-72 overflow-auto rounded bg-muted p-2 text-xs">{show(part.output)}</pre>
        )}
        {part.errorText && <p className="text-xs text-destructive">{part.errorText}</p>}
        {waiting && onApprove && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onApprove(part.approvalId!, true)} className="gap-1"><Check className="size-3.5" /> موافقة وتنفيذ</Button>
            <Button size="sm" variant="outline" onClick={() => onApprove(part.approvalId!, false)} className="gap-1"><X className="size-3.5" /> رفض</Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
