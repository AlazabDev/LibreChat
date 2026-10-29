// منطق تفويض بلا اعتماد على Deno كي يُختبَر محليًا.
// verify_jwt = true في البوابة يتحقق من توقيع JWT قبل وصول الطلب إلى الدالة،
// لذا قراءة claim الـ role هنا آمنة (لا تُستخدم إلا مع verify_jwt مفعّلًا).

export function decodeRole(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const role = JSON.parse(atob(b64))?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// مستدعٍ خادمي موثوق (AZ-Codex يرسل SUPABASE_SERVICE_ROLE_KEY كـ Bearer).
export function isServiceCaller(token: string, serviceKey: string): boolean {
  if (serviceKey && safeEqual(token, serviceKey)) return true;
  return decodeRole(token) === "service_role";
}
