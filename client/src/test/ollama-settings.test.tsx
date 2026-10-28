import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  test: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/ollama.functions", () => ({
  getOllamaModels: mocks.list,
  testOllamaConnection: mocks.test,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: mocks.save } },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { AgentsManager } from "@/components/AgentsManager";
import { DEFAULT_AGENTS } from "@/lib/agents";

const local = {
  id: "local",
  name: "محلي",
  model: "ollama/qwen:8b",
  instructions: "تعليمات محلية",
  benchTools: false,
};
function setup(list = [...DEFAULT_AGENTS, local]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AgentsManager initial={{ list, activeId: "local" }} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.list.mockResolvedValue({
    ok: true,
    models: [{ id: "ollama/qwen:8b", label: "qwen:8b" }],
    message: "متصل",
  });
  mocks.save.mockResolvedValue({ error: null });
  mocks.test.mockResolvedValue({ ok: true, message: "نجح اختبار Ollama" });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("Ollama settings", () => {
  it("loads models on demand and preserves saved agents when saving", async () => {
    setup();
    expect(mocks.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "جلب / تحديث نماذج Ollama" }));
    await screen.findByText(/تم العثور على 1 نموذج/);
    fireEvent.click(screen.getByRole("button", { name: "حفظ الوكلاء" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0]![0].data.agents.list).toEqual([...DEFAULT_AGENTS, local]);
  });

  it("tests the selected saved model without needing to save the draft first", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "اختبار اتصال Ollama" }));
    await waitFor(() => expect(mocks.test).toHaveBeenCalledWith({ data: "ollama/qwen:8b" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("نجح اختبار Ollama"));
    expect(await screen.findByText("نجح اختبار Ollama")).toBeVisible();
  });

  it("keeps a failed generation diagnostic visible beside its model", async () => {
    mocks.test.mockResolvedValueOnce({
      ok: false,
      code: "reasoning_only",
      message: "الخدمة متصلة لكن الإجابة لم تكتمل",
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "اختبار اتصال Ollama" }));
    expect(await screen.findByText("الخدمة متصلة لكن الإجابة لم تكتمل")).toBeVisible();
    expect(mocks.error).toHaveBeenCalledWith("الخدمة متصلة لكن الإجابة لم تكتمل");
  });

  it("shows offline and empty-catalog states without deleting saved choices", async () => {
    mocks.list
      .mockResolvedValueOnce({ ok: false, models: [], message: "الخدمة غير متاحة" })
      .mockResolvedValueOnce({ ok: true, models: [], message: "متصل" });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "جلب / تحديث نماذج Ollama" }));
    await screen.findByText("الخدمة غير متاحة");
    fireEvent.click(screen.getByRole("button", { name: "جلب / تحديث نماذج Ollama" }));
    await screen.findByText(/لا توجد نماذج مثبتة/);
    expect(screen.getByRole("combobox", { name: "نموذج محلي" })).toHaveTextContent(
      "Ollama · qwen:8b",
    );
  });

  it("lets a current agent select a discovered Ollama model", async () => {
    setup([...DEFAULT_AGENTS]);
    fireEvent.click(screen.getByRole("button", { name: "جلب / تحديث نماذج Ollama" }));
    await screen.findByText(/تم العثور على 1 نموذج/);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "نموذج AzCodex" }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: "Ollama · qwen:8b" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ الوكلاء" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0]![0].data.agents.list[0].model).toBe("ollama/qwen:8b");
    expect(mocks.save.mock.calls[0]![0].data.agents.list[1].model).toBe(DEFAULT_AGENTS[1]!.model);
  });
});
