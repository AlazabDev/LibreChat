import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkOllamaModel,
  listOllamaModels,
  ollamaConfig,
  ollamaFailure,
  ollamaTestTimeoutMs,
} from "@/lib/ai/ollama.server";

beforeEach(() => {
  vi.stubEnv("OLLAMA_AUTH_USER", "");
  vi.stubEnv("OLLAMA_AUTH_PASS", "");
  vi.stubEnv("OLLAMA_API_KEY", "");
  vi.stubEnv("OLLAMA_BASE_URL", "https://gateway.example");
  vi.stubEnv("OLLAMA_TEST_TIMEOUT_SECONDS", "300");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function completion(content: string | null, reasoning = "", finish = "stop") {
  return Response.json({
    id: "test",
    model: "gpt-oss:20b",
    choices: [
      {
        index: 0,
        finish_reason: finish,
        message: { role: "assistant", content, reasoning_content: reasoning },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

describe("deployment authentication", () => {
  it("uses the same Basic authorization for discovery, capabilities and SDK generation", async () => {
    vi.stubEnv("OLLAMA_AUTH_USER", "azureuser");
    vi.stubEnv("OLLAMA_AUTH_PASS", "test:password");
    vi.stubEnv("OLLAMA_API_KEY", "unused-bearer-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ models: [{ name: "gpt-oss:20b" }] }))
      .mockResolvedValueOnce(Response.json({ capabilities: ["completion", "tools", "thinking"] }))
      .mockResolvedValueOnce(completion("OK"));
    vi.stubGlobal("fetch", fetchMock);
    await listOllamaModels();
    const result = await checkOllamaModel("ollama/gpt-oss:20b");
    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://gateway.example/api/tags",
      "https://gateway.example/api/show",
      "https://gateway.example/v1/chat/completions",
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options.headers).get("Authorization")).toBe(
        `Basic ${Buffer.from("azureuser:test:password").toString("base64")}`,
      );
    }
    const generation = JSON.parse(fetchMock.mock.calls[2]![1].body);
    expect(generation.reasoning_effort).toBe("low");
    expect(generation.max_tokens).toBe(1024);
    expect(JSON.stringify(result)).not.toMatch(/test:password|unused-bearer-key|Basic /);
  });

  it("supports unauthenticated loopback without a synthetic bearer token", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
    expect(ollamaConfig()).toEqual({
      baseURL: "http://127.0.0.1:11434",
      headers: {},
      authMode: "none",
    });
  });

  it.each([
    ["azureuser", ""],
    ["", "password"],
    ["bad:user", "password"],
  ])("rejects incomplete or invalid Basic credentials", (username, password) => {
    vi.stubEnv("OLLAMA_AUTH_USER", username);
    vi.stubEnv("OLLAMA_AUTH_PASS", password);
    vi.stubEnv("OLLAMA_API_KEY", "must-not-mask-bad-config");
    expect(() => ollamaConfig()).toThrow("إعداد مصادقة Ollama");
  });
});

describe("generation diagnostics", () => {
  it.each([
    [401, "authentication"],
    [403, "forbidden"],
    [404, "not_found"],
    [500, "upstream"],
  ])("classifies native HTTP %s and hides the response body", async (status, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private proxy details", { status })),
    );
    const result = await checkOllamaModel("ollama/gpt-oss:20b");
    expect(result).toMatchObject({ ok: false, stage: "capabilities", code });
    expect(JSON.stringify(result)).not.toContain("private proxy details");
  });

  it("classifies inference failures separately from discovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities: ["completion"] }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: { message: "secret upstream body", type: "server_error" } }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
    );
    const result = await checkOllamaModel("ollama/qwen:8b");
    expect(result).toMatchObject({ ok: false, stage: "generation", code: "upstream" });
    expect(JSON.stringify(result)).not.toContain("secret upstream body");
  });

  it("does not call a reasoning-only response an offline service or a successful answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities: ["completion", "thinking"] }))
        .mockResolvedValueOnce(completion(null, "Still thinking", "length")),
    );
    const result = await checkOllamaModel("ollama/gpt-oss:20b");
    expect(result).toMatchObject({ ok: false, code: "reasoning_only", stage: "generation" });
    expect(result.message).toContain("متصلة");
    expect(result.message).not.toContain("Still thinking");
  });

  it("does not mark a truncated text answer as a completed generation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities: ["completion"] }))
        .mockResolvedValueOnce(completion("Partial", "", "length")),
    );
    expect(await checkOllamaModel("ollama/qwen:8b")).toMatchObject({
      ok: false,
      code: "output_limit",
      stage: "generation",
    });
  });

  it("does not force GPT-OSS reasoning parameters onto other models", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ capabilities: ["completion", "thinking", "vision"] }))
      .mockResolvedValueOnce(completion("OK"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkOllamaModel("ollama/deepseek-r1:14b");
    expect(result).toMatchObject({ ok: true, capabilities: { thinking: true, vision: true } });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).not.toHaveProperty("reasoning_effort");
  });

  it("distinguishes empty answers and timeout/cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities: ["completion"] }))
        .mockResolvedValueOnce(completion(null)),
    );
    expect(await checkOllamaModel("ollama/qwen:8b")).toMatchObject({
      ok: false,
      code: "empty_response",
    });
    expect(ollamaFailure(new DOMException("sensitive", "TimeoutError"))).toMatchObject({
      code: "timeout",
    });
    expect(ollamaFailure(new DOMException("sensitive", "AbortError"))).toMatchObject({
      code: "cancelled",
    });
  });

  it("allows a bounded CPU generation timeout and rejects invalid settings", () => {
    expect(ollamaTestTimeoutMs()).toBe(300_000);
    vi.stubEnv("OLLAMA_TEST_TIMEOUT_SECONDS", "600");
    expect(ollamaTestTimeoutMs()).toBe(600_000);
    vi.stubEnv("OLLAMA_TEST_TIMEOUT_SECONDS", "NaN");
    expect(() => ollamaTestTimeoutMs()).toThrow("مهلة اختبار");
  });
});
