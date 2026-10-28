import { tool } from "ai";
import { z } from "zod";

// Read-only productivity tools for the chat agent. Each runs on behalf of the signed-in user.
const GATEWAY = "https://connector-gateway.lovable.dev";
const SCOPES = ["read:user", "repo"];
const slug = z.string().regex(/^[a-zA-Z0-9_.-]+$/).max(100);

async function github(userId: string, path: string) {
  const { getConnectionKeyForUser } = await import("@/lib/integrations/connections.server");
  const key = await getConnectionKeyForUser(userId, "github");
  if (!key) return { error: "GitHub غير مربوط. اربطه من صفحة GitHub في التطبيق." };
  const { callAsAppUser, appUserReconnectRequired } = await import("@/integrations/lovable/appUserConnector");
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY, connectionAPIKey: key, connectorId: "github", path,
    requiredScopes: SCOPES, init: { headers: { Accept: "application/vnd.github+json" } },
  });
  if (await appUserReconnectRequired(res)) return { error: "يجب إعادة ربط GitHub." };
  if (!res.ok) return { error: `GitHub (${res.status}): ${(await res.text()).slice(0, 300)}` };
  return { data: (await res.json()) as unknown };
}

export function integrationTools(userId: string) {
  return {
    github_list_repos: tool({
      description: "اعرض مستودعات GitHub الخاصة بالمستخدم (الأحدث أولاً).",
      inputSchema: z.object({ page: z.number().int().default(1) }),
      execute: async ({ page }) => {
        const r = await github(userId, `/user/repos?per_page=30&sort=updated&page=${Math.min(Math.max(page, 1), 50)}`);
        if (!("data" in r)) return r;
        return (r.data as Array<Record<string, unknown>>).map((x) => ({
          full_name: x["full_name"], private: x["private"], default_branch: x["default_branch"], description: x["description"],
        }));
      },
    }),
    github_read: tool({
      description: "اقرأ ملفاً أو اعرض مجلداً داخل مستودع GitHub.",
      inputSchema: z.object({ owner: slug, repo: slug, path: z.string().default(""), ref: z.string().default("") }),
      execute: async ({ owner, repo, path, ref }) => {
        const p = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
        const r = await github(userId, `/repos/${owner}/${repo}/contents/${p}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
        if (!("data" in r)) return r;
        const d = r.data as Record<string, unknown> | Array<Record<string, unknown>>;
        if (Array.isArray(d)) return d.map((x) => `${x["type"] === "dir" ? "📁" : "📄"} ${x["path"]}`);
        const content = typeof d["content"] === "string" ? atob(d["content"].replace(/\n/g, "")) : "";
        return { path: d["path"], size: d["size"], content: new TextDecoder().decode(Uint8Array.from(content, (c) => c.charCodeAt(0))).slice(0, 40_000) };
      },
    }),
    github_commits: tool({
      description: "اعرض آخر الالتزامات في مستودع GitHub.",
      inputSchema: z.object({ owner: slug, repo: slug, ref: z.string().default("") }),
      execute: async ({ owner, repo, ref }) => {
        const r = await github(userId, `/repos/${owner}/${repo}/commits?per_page=20${ref ? `&sha=${encodeURIComponent(ref)}` : ""}`);
        if (!("data" in r)) return r;
        return (r.data as Array<{ sha: string; commit: { message: string; author: { name: string; date: string } | null } }>).map((c) => ({
          sha: c.sha.slice(0, 7), message: c.commit.message.split("\n")[0], author: c.commit.author?.name, date: c.commit.author?.date,
        }));
      },
    }),
    frappe_list: tool({
      description: "اقرأ سجلات من Frappe/ERPNext (قراءة فقط) مثل Project أو Task أو Customer.",
      inputSchema: z.object({ doctype: z.string(), fields: z.array(z.string()).default(["name", "modified"]), limit: z.number().int().default(20) }),
      execute: async ({ doctype, fields, limit }) => {
        const url = process.env["FRAPPE_URL"], key = process.env["FRAPPE_API_KEY"], secret = process.env["FRAPPE_API_SECRET"];
        if (!url || !key || !secret) return { error: "Frappe غير مربوط بعد: يلزم رابط الموقع ومفتاح الوصول على الخادم." };
        if (!/^[A-Za-z0-9 _-]{1,80}$/.test(doctype)) return { error: "اسم DocType غير صالح" };
        const qs = new URLSearchParams({ fields: JSON.stringify(fields.slice(0, 20)), limit_page_length: String(Math.min(Math.max(limit, 1), 100)), order_by: "modified desc" });
        const res = await fetch(`${url.replace(/\/$/, "")}/api/resource/${encodeURIComponent(doctype)}?${qs}`, { headers: { Authorization: `token ${key}:${secret}` } });
        if (!res.ok) return { error: `Frappe (${res.status}): ${(await res.text()).slice(0, 300)}` };
        return ((await res.json()) as { data: unknown }).data;
      },
    }),
    web_search: tool({
      description: "ابحث في الإنترنت عن معلومات حديثة وأعد العناوين والروابط والمقتطفات.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const key = process.env["FIRECRAWL_API_KEY"];
        if (!key) return { error: "بحث الويب غير مفعّل بعد على الخادم." };
        const res = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.slice(0, 300), limit: 5 }),
        });
        if (!res.ok) return { error: `البحث (${res.status}): ${(await res.text()).slice(0, 300)}` };
        const j = (await res.json()) as { data?: { web?: Array<{ title?: string; url?: string; description?: string }> } };
        return (j.data?.web ?? []).map((w) => ({ title: w.title, url: w.url, snippet: w.description }));
      },
    }),
  };
}
