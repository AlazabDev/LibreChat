import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const testAgentConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, message: "إعدادات اتصال الوكيل غير مكتملة." };
    try {
      const provider = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1", apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const result = await generateText({
        model: provider.responses("openai/gpt-6-astra"),
        prompt: "Reply with OK only.", maxOutputTokens: 100,
        abortSignal: AbortSignal.timeout(30000),
      });
      return result.text.trim() ? { ok: true, message: "تم الاتصال بالوكيل بنجاح." } : { ok: false, message: "لم تصل استجابة من الوكيل؛ حاول مرة أخرى." };
    } catch {
      return { ok: false, message: "تعذر الاتصال بالوكيل. تحقق من رصيد الذكاء الاصطناعي وحاول مجدداً." };
    }
  });