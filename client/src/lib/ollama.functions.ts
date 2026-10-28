import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ollamaModelSchema } from "@/lib/agents";

export const getOllamaModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const ollama = await import("./ai/ollama.server");
    try {
      return {
        ok: true as const,
        models: await ollama.listOllamaModels(),
        message: "تم الاتصال بخدمة Ollama.",
      };
    } catch (error) {
      return { ...ollama.ollamaFailure(error), models: [] };
    }
  });

export const testOllamaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ollamaModelSchema.parse(data))
  .handler(async ({ data }) => {
    const ollama = await import("./ai/ollama.server");
    return ollama.checkOllamaModel(data);
  });
