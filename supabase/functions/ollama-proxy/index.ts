// Ollama proxy: secrets are read only inside Supabase Edge Runtime.
// Deploy to the same project configured by AZ-Codex SUPABASE_URL.
const OLLAMA_ORIGIN = "https://ollama.alazab.com";
const ALLOWED = new Set(["/api/tags", "/api/show", "/v1/chat/completions"]);
const cors = { "Cache-Control": "no-store" };
Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // JWT verification is enforced by Supabase gateway (verify_jwt=true).
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
  const username = Deno.env.get("OLLAMA_AUTH_USER");
  const password = Deno.env.get("OLLAMA_AUTH_PASS");
  if (!username || !password) return new Response("Ollama credentials missing", { status: 503 });
  let payload: { path?: string; body?: unknown };
  try { payload = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (!payload || typeof payload.path !== "string" || !ALLOWED.has(payload.path))
    return new Response("Unsupported path", { status: 400 });
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
