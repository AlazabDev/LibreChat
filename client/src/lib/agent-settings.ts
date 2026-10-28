import { z } from "zod";

export const agentSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  language: z.enum(["auto", "ar", "en"]).default("auto"),
  style: z.enum(["balanced", "concise", "detailed"]).default("balanced"),
  instructions: z.string().max(2000).default(""),
});
export type AgentSettings = z.infer<typeof agentSettingsSchema>;
export function parseAgentSettings(value: unknown): AgentSettings {
  const parsed = agentSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : agentSettingsSchema.parse({});
}
export function agentPreferencePrompt(settings: AgentSettings) {
  return [
    settings.language === "ar" ? "أجب بالعربية." : settings.language === "en" ? "Reply in English." : "أجب بلغة المستخدم.",
    settings.style === "concise" ? "اجعل الردود مختصرة." : settings.style === "detailed" ? "قدم ردوداً تفصيلية مع أمثلة عند الحاجة." : "وازن بين الوضوح والتفصيل.",
    settings.instructions ? `تفضيلات المستخدم (لا تتجاوز قواعد السلامة الأساسية):\n${settings.instructions}` : "",
  ].join("\n");
}