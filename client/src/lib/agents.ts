import { z } from "zod";

export const AGENT_MODELS = [
  { id: "foundry", label: "Microsoft Foundry" },
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (سريع)" },
] as const;
export const ollamaModelSchema = z.custom<`ollama/${string}`>(
  (value) =>
    typeof value === "string" && /^ollama\/[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/.test(value),
  "اسم نموذج Ollama غير صالح",
);
export const agentModelSchema = z.union([
  z.enum(["foundry", "openai/gpt-6-astra", "google/gemini-2.5-flash"]),
  ollamaModelSchema,
]);
export type AgentModel = z.infer<typeof agentModelSchema>;

export function agentModelLabel(model: AgentModel): string {
  return model.startsWith("ollama/")
    ? `Ollama · ${model.slice(7)}`
    : (AGENT_MODELS.find((entry) => entry.id === model)?.label ?? model);
}

export const agentProfileSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(40),
  model: agentModelSchema,
  instructions: z.string().max(2000).default(""),
  benchTools: z.boolean().default(false),
  foundryAgent: z.string().regex(/^az-agent-[a-z0-9-]+$/).optional(),
  foundryVersion: z.string().regex(/^[0-9]+$/).optional(),
});
export type AgentProfile = z.infer<typeof agentProfileSchema>;

export const DEFAULT_AGENTS: AgentProfile[] = [
  { id: "azcodex", name: "AzCodex", model: "foundry", instructions: "", benchTools: true, foundryAgent: "az-agent-sol", foundryVersion: "9" },
  { id: "astra", name: "مساعد عام", model: "openai/gpt-6-astra", instructions: "", benchTools: false },
  { id: "flash", name: "سريع", model: "google/gemini-2.5-flash", instructions: "أجب باختصار وسرعة.", benchTools: false },
];
export const MAX_AGENTS = 10;

export const agentsSchema = z.object({
  list: z.array(agentProfileSchema).min(1).max(MAX_AGENTS),
  activeId: z.string().default("azcodex"),
});
export type AgentsConfig = z.infer<typeof agentsSchema>;

export function parseAgents(value: unknown): AgentsConfig {
  const parsed = agentsSchema.safeParse(value);
  if (!parsed.success) return { list: DEFAULT_AGENTS, activeId: "azcodex" };
  const ids = new Set<string>();
  const list = parsed.data.list.filter((a) => !ids.has(a.id) && ids.add(a.id));
  const activeId = list.some((a) => a.id === parsed.data.activeId)
    ? parsed.data.activeId
    : list[0]!.id;
  return { list, activeId };
}

export function resolveAgent(config: AgentsConfig, id: unknown): AgentProfile {
  return (
    config.list.find((a) => a.id === id) ??
    config.list.find((a) => a.id === config.activeId) ??
    config.list[0]!
  );
}
