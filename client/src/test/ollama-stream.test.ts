import { afterEach, describe, expect, it, vi } from "vitest";
import { generateText, streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { ollamaChatModel } from "@/lib/ai/ollama.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function sse(deltas: Record<string, unknown>[], finish = "stop") {
  const chunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    id: "chat-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "qwen:8b",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
  const events = [...deltas.map((delta) => chunk(delta)), chunk({}, finish)];
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n",
    {
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

describe("real AI SDK Ollama protocol", () => {
  it("streams separate reasoning and answer parts into the existing UI protocol", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434/v1/");
    vi.stubEnv("OLLAMA_API_KEY", "ollama-test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sse([
          { role: "assistant", reasoning_content: "أفكر" },
          { content: "مرحبا" },
          { content: " محمد" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = streamText({ model: ollamaChatModel("ollama/qwen:8b"), prompt: "Hello" });
    const response = result.toUIMessageStreamResponse({ sendReasoning: true });
    const body = await response.text();
    expect(body).toContain('"type":"reasoning-delta"');
    expect(body).toContain("أفكر");
    expect(body).toContain('"type":"text-delta"');
    expect(await result.text).toBe("مرحبا محمد");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:11434/v1/chat/completions");
    const options = fetchMock.mock.calls[0]![1];
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer ollama-test-key");
    const payload = JSON.parse(options.body);
    expect(payload.model).toBe("qwen:8b");
    expect(payload.stream).toBe(true);
    expect(payload).not.toHaveProperty("reasoning_effort");
    expect(payload).not.toHaveProperty("store");
  });

  it("executes streamed tool calls and sends their results back for the final answer", async () => {
    const execute = vi.fn().mockResolvedValue({ count: 42 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sse(
          [
            {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: { name: "lookup", arguments: '{"name":"projects"}' },
                },
              ],
            },
          ],
          "tool_calls",
        ),
      )
      .mockResolvedValueOnce(sse([{ content: "42 projects" }]));
    vi.stubGlobal("fetch", fetchMock);
    const result = streamText({
      model: ollamaChatModel("ollama/qwen:8b"),
      prompt: "Count projects",
      tools: { lookup: tool({ inputSchema: z.object({ name: z.string() }), execute }) },
      stopWhen: stepCountIs(3),
    });
    await result.consumeStream();
    expect(await result.text).toBe("42 projects");
    expect(execute).toHaveBeenCalledWith({ name: "projects" }, expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const followup = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(followup.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "tool", tool_call_id: "call_1", content: '{"count":42}' }),
      ]),
    );
  });

  it("supports the non-streaming connection check with the same adapter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          id: "test",
          model: "qwen:8b",
          choices: [
            { index: 0, finish_reason: "stop", message: { role: "assistant", content: "OK" } },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
      ),
    );
    const result = await generateText({
      model: ollamaChatModel("ollama/qwen:8b"),
      prompt: "OK",
      maxOutputTokens: 128,
    });
    expect(result.text).toBe("OK");
  });
});
