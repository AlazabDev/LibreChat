import { afterEach, describe, expect, it, vi } from "vitest";
import { agentModelLabel, agentProfileSchema, DEFAULT_AGENTS, parseAgents } from "@/lib/agents";
import {
  listOllamaModels,
  ollamaCapabilities,
  ollamaConfig,
  ollamaErrorMessage,
  validateOllamaAttachments,
} from "@/lib/ai/ollama.server";
import type { UIMessage } from "ai";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const messageWithFile = (mediaType: string): UIMessage[] => [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "file", mediaType, url: "https://storage.example/file" }],
  },
];

describe("Ollama model configuration", () => {
  it("preserves existing agents and persists namespaced Ollama model names", () => {
    const local = { ...DEFAULT_AGENTS[0]!, id: "local", model: "ollama/team/qwen:8b" };
    const config = parseAgents({ list: [...DEFAULT_AGENTS, local], activeId: "local" });
    expect(config.list.slice(0, 3)).toEqual(DEFAULT_AGENTS);
    expect(config.list[3]?.model).toBe("ollama/team/qwen:8b");
    expect(config.activeId).toBe("local");
    expect(agentModelLabel("ollama/team/qwen:8b")).toBe("Ollama · team/qwen:8b");
  });

  it.each(["ollama/", "ollama/bad model", "http://localhost", "unknown/model"])(
    "rejects invalid model %s",
    (model) => {
      expect(agentProfileSchema.safeParse({ ...DEFAULT_AGENTS[0], model }).success).toBe(false);
    },
  );

  it("normalizes a /v1 suffix and keeps credentials server-side", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "https://models.example/ollama/v1/");
    vi.stubEnv("OLLAMA_API_KEY", "private-key");
    expect(ollamaConfig()).toEqual({
      baseURL: "https://models.example/ollama",
      headers: { Authorization: "Bearer private-key" },
      authMode: "bearer",
    });
  });

  it.each([
    "file:///tmp/ollama",
    "https://user:password@example.com",
    "http://localhost:11434?other=1",
  ])("rejects invalid deployment URL %s", (url) => {
    vi.stubEnv("OLLAMA_BASE_URL", url);
    expect(() => ollamaConfig()).toThrow();
  });
});

describe("Ollama discovery and capabilities", () => {
  it("fetches the deployment's catalog, deduplicates it and excludes invalid names", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("OLLAMA_API_KEY", "private-key");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        models: [
          { name: "qwen:8b" },
          { name: "gpt-oss:20b" },
          { name: "qwen:8b" },
          { name: "bad name" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await listOllamaModels()).toEqual([
      { id: "ollama/gpt-oss:20b", label: "gpt-oss:20b" },
      { id: "ollama/qwen:8b", label: "qwen:8b" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer private-key" }),
      }),
    );
  });

  it("recognizes tools/vision and sends the unprefixed model to /api/show", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ capabilities: ["completion", "tools", "vision"] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await ollamaCapabilities("ollama/qwen:8b")).toEqual({
      tools: true,
      vision: true,
      thinking: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ model: "qwen:8b" });
  });

  it("falls back to text-only on older servers and rejects embedding-only models", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(Response.json({ capabilities: ["embedding"] })),
    );
    expect(await ollamaCapabilities("ollama/old:latest")).toEqual({
      tools: false,
      vision: false,
      thinking: false,
    });
    await expect(ollamaCapabilities("ollama/embed:latest")).rejects.toThrow("لا يدعم المحادثة");
  });

  it("explains missing models and hides upstream error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("secret details", { status: 404 })),
    );
    await expect(ollamaCapabilities("ollama/deleted:latest")).rejects.toThrow("غير موجود");
    expect(ollamaErrorMessage(new Error("private-key from upstream"))).not.toContain("private-key");
  });

  it("supports images only for vision models and rejects unsupported documents", () => {
    expect(() => validateOllamaAttachments(messageWithFile("image/png"), true)).not.toThrow();
    expect(() => validateOllamaAttachments(messageWithFile("image/png"), false)).toThrow(
      "لا يدعم الصور",
    );
    expect(() => validateOllamaAttachments(messageWithFile("application/pdf"), true)).toThrow(
      "المرفقات المصورة فقط",
    );
    expect(() => validateOllamaAttachments([], false)).not.toThrow();
  });
});
