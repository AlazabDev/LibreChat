import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3Icon, CodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "./message";

type ChartSpec = {
  type: "bar" | "line" | "area" | "pie" | "donut";
  title?: string;
  description?: string;
  xKey?: string;
  series?: { key: string; label?: string }[];
  stacked?: boolean;
  data: Record<string, string | number>[];
};

const COLORS: string[] = [1, 2, 3, 4, 5].map((n) => `var(--chart-${n})`);

function parseSpec(raw: string): ChartSpec | null {
  try {
    const s = JSON.parse(raw) as ChartSpec;
    if (!s || !Array.isArray(s.data) || s.data.length === 0) return null;
    if (!["bar", "line", "area", "pie", "donut"].includes(s.type)) s.type = "bar";
    return s;
  } catch {
    return null;
  }
}

function resolve(spec: ChartSpec) {
  const first = spec.data[0] ?? {};
  const keys = Object.keys(first);
  const xKey: string = spec.xKey ?? keys.find((k) => typeof first[k] === "string") ?? keys[0] ?? "name";
  const series =
    spec.series && spec.series.length
      ? spec.series
      : keys.filter((k) => k !== xKey && typeof first[k] === "number").map((k): { key: string; label?: string } => ({ key: k }));
  return { xKey, series };
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
};

export function AgentChart({ raw }: { raw: string }) {
  const spec = useMemo(() => parseSpec(raw), [raw]);
  const [showCode, setShowCode] = useState(false);
  if (!spec)
    return (
      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        تعذر قراءة بيانات الرسم البياني.
      </div>
    );
  const { xKey, series } = resolve(spec);
  const axisProps = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false };

  let chart: React.ReactElement;
  if (spec.type === "pie" || spec.type === "donut") {
    const valueKey = series[0]?.key ?? "value";
    chart = (
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Pie
          data={spec.data}
          dataKey={valueKey}
          nameKey={xKey}
          innerRadius={spec.type === "donut" ? "55%" : 0}
          outerRadius="80%"
          paddingAngle={2}
          label
        >
          {spec.data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length] ?? "var(--chart-1)"} stroke="var(--background)" />
          ))}
        </Pie>
      </PieChart>
    );
  } else {
    const Chart = spec.type === "line" ? LineChart : spec.type === "area" ? AreaChart : BarChart;
    chart = (
      <Chart data={spec.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={44} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => {
          const color = COLORS[i % COLORS.length] ?? "var(--chart-1)";
          const name = s.label ?? s.key;
          const stack = spec.stacked ? { stackId: "a" } : {};
          if (spec.type === "line")
            return <Line key={s.key} dataKey={s.key} name={name} stroke={color} strokeWidth={2} dot={{ r: 3 }} type="monotone" />;
          if (spec.type === "area")
            return <Area key={s.key} dataKey={s.key} name={name} stroke={color} fill={color} fillOpacity={0.25} type="monotone" {...stack} />;
          return <Bar key={s.key} dataKey={s.key} name={name} fill={color} radius={[4, 4, 0, 0]} {...stack} />;
        })}
      </Chart>
    );
  }

  return (
    <div className="my-2 w-full min-w-[280px] rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          {spec.title && <div className="font-semibold text-card-foreground">{spec.title}</div>}
          {spec.description && <div className="text-xs text-muted-foreground">{spec.description}</div>}
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => setShowCode((v) => !v)} aria-label="عرض البيانات">
          {showCode ? <BarChart3Icon className="size-4" /> : <CodeIcon className="size-4" />}
        </Button>
      </div>
      {showCode ? (
        <pre dir="ltr" className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(spec, null, 2)}</pre>
      ) : (
        <div dir="ltr" className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Renders assistant markdown, replacing ```chart blocks with live charts. */
export function ChartedResponse({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const segments = useMemo(() => {
    const out: { kind: "md" | "chart" | "pending"; value: string }[] = [];
    const re = /```chart\s*\n([\s\S]*?)(```|$)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ kind: "md", value: text.slice(last, m.index) });
      out.push({ kind: m[2] === "```" ? "chart" : "pending", value: m[1] ?? "" });
      last = re.lastIndex;
      if (m[0].length === 0) break;
    }
    if (last < text.length) out.push({ kind: "md", value: text.slice(last) });
    return out;
  }, [text]);

  return (
    <>
      {segments.map((s, i) =>
        s.kind === "md" ? (
          s.value.trim() ? <MessageResponse key={i} isAnimating={!!isStreaming}>{s.value}</MessageResponse> : null
        ) : s.kind === "chart" ? (
          <AgentChart key={i} raw={s.value} />
        ) : (
          <div key={i} className="my-2 flex h-72 w-full min-w-[280px] animate-pulse items-center justify-center rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
            جارٍ إنشاء الرسم البياني…
          </div>
        ),
      )}
    </>
  );
}
