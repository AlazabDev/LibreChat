import { describe, expect, it } from "vitest";
import { parseAgents, resolveAgent, DEFAULT_AGENTS } from "@/lib/agents";

describe("multi agents", () => {
  it("falls back to default agents", () => {
    expect(parseAgents(undefined).list).toEqual(DEFAULT_AGENTS);
  });
  it("resolves the requested agent, else the default one", () => {
    const cfg = parseAgents({ list: DEFAULT_AGENTS, activeId: "flash" });
    expect(resolveAgent(cfg, "astra").id).toBe("astra");
    expect(resolveAgent(cfg, "missing").id).toBe("flash");
  });
});
