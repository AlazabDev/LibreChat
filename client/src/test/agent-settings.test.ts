import { describe, expect, it } from "vitest";
import { parseAgentSettings, agentPreferencePrompt } from "@/lib/agent-settings";

describe("agent settings", () => {
  it("defaults malformed metadata safely", () => {
    expect(parseAgentSettings(undefined).enabled).toBe(true);
    expect(parseAgentSettings({ language: "invalid" }).language).toBe("auto");
    expect(parseAgentSettings({ instructions: "x".repeat(2001) }).instructions).toBe("");
  });
  it("applies saved preferences to the agent prompt", () => {
    const settings = parseAgentSettings({ enabled: false, language: "en", style: "concise", instructions: "Use examples" });
    expect(settings.enabled).toBe(false);
    expect(agentPreferencePrompt(settings)).toContain("Reply in English");
    expect(agentPreferencePrompt(settings)).toContain("مختصرة");
    expect(agentPreferencePrompt(settings)).toContain("Use examples");
  });
});