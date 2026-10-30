// Ollama proxy: secrets are read only inside Supabase Edge Runtime.
// Deploy to the same project configured by AZ-Codex SUPABASE_URL.
//
// الأمان: verify_jwt في البوابة يقبل أي JWT صالح للمشروع بما فيه المفتاح العام anon،
// لذلك نتحقق هنا أن الرمز يعود لمستخدم حقيقي (ليس anon ولا مجهول) عبر auth.getUser.
// اختياري: OLLAMA_ALLOWED_EMAIL_DOMAINS=alazab.com,example.org لقصر الاستخدام على نطاقات بريد.
import { createClient } from "npm:@supabase/supabase-js@2";

const OLLAMA_ORIGIN = "https://ollama.alazab.com";
const ALLOWED = new Set(["/api/tags", "/api/show", "/v1/chat/completions"]);
const MAX_BODY_BYTES = 1_000_000; // ~1MB
const cors = { "Cache-Control": "no-store" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_DOMAINS = (Deno.env.get("OLLAMA_ALLOWED_EMAIL_DOMAINS") ?? "")
  .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

async function verifiedUser(request: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
  if (!match || !SUPABASE_URL || !SERVICE_KEY) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.getUser(match[1]);
  const user = data?.user;
  if (error || !user || user.is_anonymous) return null;
  if (ALLOWED_DOMAINS.length) {
    const domain = (user.email ?? "").split("@")[1]?.toLowerCase() ?? "";
    if (!ALLOWED_DOMAINS.includes(domain)) return null;
  }
  return user;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  if (!(await verifiedUser(request))) return new Response("Unauthorized", { status: 401, headers: cors });

  const username = Deno.env.get("OLLAMA_AUTH_USER");
  const password = Deno.env.get("OLLAMA_AUTH_PASS");
  if (!username || !password) return new Response("Ollama credentials missing", { status: 503, headers: cors });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413, headers: cors });
  let payload: { path?: string; body?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413, headers: cors });
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400, headers: cors });
  }
  if (!payload || typeof payload.path !== "string" || !ALLOWED.has(payload.path))
    return new Response("Unsupported path", { status: 400, headers: cors });

  const target = payload.path;
  const headers = new Headers({
    Authorization: "Basic " + btoa(username + ":" + password),
    Accept: target === "/v1/chat/completions" ? "text/event-stream" : "application/json",
  });
  if (target !== "/api/tags") headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), target === "/v1/chat/completions" ? 300_000 : 15_000);
  try {
    const result = await fetch(OLLAMA_ORIGIN + target, {
      method: target === "/api/tags" ? "GET" : "POST",
      headers,
      ...(target === "/api/tags" ? {} : { body: JSON.stringify(payload.body ?? {}) }),
      signal: controller.signal,
      redirect: "error",
    });
    const outHeaders = new Headers(cors);
    outHeaders.set("Content-Type", result.headers.get("content-type") ?? "application/json");
    return new Response(result.body, { status: result.status, headers: outHeaders });
  } catch {
    return new Response("Ollama upstream unavailable", { status: 502, headers: cors });
  } finally { clearTimeout(timeout); }
});
