import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  thread: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  stream: vi.fn(),
  foundry: vi.fn(),
  tools: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.user },
    from: (table: string) =>
      table === "messages"
        ? { upsert: mocks.upsert }
        : {
            select: () => ({ eq: () => ({ maybeSingle: mocks.thread }) }),
            update: (value: unknown) => ({ eq: () => mocks.update(value) }),
          },
  }),
}));
vi.mock("@/lib/ai/foundry.server", () => ({
  foundryConfigured: mocks.foundry,
  foundryProvider: () => ({
    responses: () => ({ provider: "foundry", modelId: "az-agent-copilot" }),
  }),
}));
vi.mock("@/lib/ai/integration-tools.server", () => ({ integrationTools: mocks.tools }));
vi.mock("@/lib/ai/bench-tools.server", () => ({ benchToolsEnabled: () => false }));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: mocks.stream,
}));

import { Route } from "@/routes/api/chat";

// The router wrapper is mocked; the handler, authentication, provider selection,
// message conversion and persistence callbacks below are the actual route code.
const post = (
  Route as unknown as {
    server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
const messages: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "مرحبا" }] },
];

function request(token = "test-token", agentId = "local") {
  return new Request("http://app.example/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ threadId: "t1", agentId, messages }),
  });
}

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "");
  vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
  mocks.foundry.mockReturnValue(false);
  mocks.user.mockResolvedValue({
    data: {
      user: {
        id: "user1",
        user_metadata: {
          agents: {
            list: [
              { id: "local", name: "Local", model: "ollama/qwen:8b" },
              { id: "azure", name: "Azure", model: "foundry" },
              { id: "cloud", name: "Cloud", model: "openai/gpt-6-astra" },
            ],
            activeId: "local",
          },
        },
      },
    },
  });
  mocks.thread.mockResolvedValue({ data: { id: "t1", title: "محادثة جديدة" } });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.tools.mockReturnValue({ marker: {} });
  mocks.stream.mockReturnValue({
    toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ capabilities: ["completion", "tools"] })),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("chat provider routing", () => {
  it("rejects unauthenticated requests before any upstream call", async () => {
    expect((await post({ request: request("") })).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("checks conversation access before contacting Ollama", async () => {
    mocks.thread.mockResolvedValue({ data: null });
    expect((await post({ request: request() })).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("streams Ollama without a gateway key, keeps tools and persists messages", async () => {
    const response = await post({ request: request() });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("stream");
    const args = mocks.stream.mock.calls[0]![0];
    expect(args.model.modelId).toBe("qwen:8b");
    expect(args.providerOptions).toEqual({});
    expect(args.tools).toHaveProperty("marker");
    expect(args.system).toContain("AzCodex");
    const options = mocks.stream.mock.results[0]!.value.toUIMessageStreamResponse.mock.calls[0]![0];
    await options.onFinish({
      messages: [
        ...messages,
        { id: "a1", role: "assistant", parts: [{ type: "text", text: "أهلا" }] },
      ],
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          thread_id: "t1",
          user_id: "user1",
          sdk_id: "a1",
          role: "assistant",
        }),
      ]),
      { onConflict: "thread_id,sdk_id" },
    );
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ title: "مرحبا" }));
  });

  it("does not send tools to models that do not support them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ capabilities: ["completion"] })),
    );
    await post({ request: request() });
    expect(mocks.stream.mock.calls[0]![0].tools).toEqual({});
  });

  it("fails explicitly for a missing Ollama model instead of switching providers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const response = await post({ request: request() });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("غير موجود");
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("allows configured Foundry without a Lovable key", async () => {
    mocks.foundry.mockReturnValue(true);
    expect((await post({ request: request("test-token", "azure") })).status).toBe(200);
    expect(mocks.stream.mock.calls[0]![0].model.provider).toBe("foundry");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves the existing GPT gateway model, options and response headers", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "gateway-key");
    const req = request("test-token", "cloud");
    req.headers.set("X-Lovable-AIG-Run-ID", "existing-run");
    const response = await post({ request: req });
    expect(await response.text()).toBe("stream");
    expect(response.headers.get("X-Lovable-AIG-Run-ID")).toBe("existing-run");
    const args = mocks.stream.mock.calls[0]![0];
    expect(args.model.modelId).toBe("openai/gpt-6-astra");
    expect(args.providerOptions.openai.reasoningEffort).toBe("medium");
    expect(args.abortSignal).toBe(req.signal);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still requires the gateway key for existing gateway models", async () => {
    expect((await post({ request: request("test-token", "cloud") })).status).toBe(500);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
