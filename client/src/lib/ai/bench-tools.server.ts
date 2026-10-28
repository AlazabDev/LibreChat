import { tool } from "ai";
import { z } from "zod";

// Full-auto tools. Only active on the self-hosted server (BENCH_TOOLS_ENABLED=1).
const BENCH = process.env["FRAPPE_BENCH_PATH"] ?? "/home/frappe/frappe-bench";
const CODEX = process.env["CODEX_APP_PATH"] ?? "/home/frappe/az-codex-ts";
// Irreversible operations stay blocked even in full-auto mode.
const BLOCKED = /\b(drop-site|reinstall|restore|--force|rm\s+-rf\s+\/|mkfs|shutdown|reboot)\b/i;

export function benchToolsEnabled() {
  return process.env["BENCH_TOOLS_ENABLED"] === "1";
}

async function safePath(rel: string, rootType: "bench" | "codex" = "bench") {
  const path = await import("node:path");
  const rootDir = rootType === "bench" ? BENCH : CODEX;
  const full = path.resolve(rootDir, rel);
  if (full !== rootDir && !full.startsWith(rootDir + path.sep)) {
    throw new Error(`المسار خارج المجلد المسموح (${rootType})`);
  }
  return full;
}

export function benchTools() {
  return {
    workspace_read_file: tool({
      description: "اقرأ ملفاً داخل مساحات العمل (frappe-bench أو az-codex-ts).",
      inputSchema: z.object({ path: z.string(), workspace: z.enum(["bench", "codex"]).default("bench") }),
      execute: async ({ path, workspace }) => {
        const fs = await import("node:fs/promises");
        return (await fs.readFile(await safePath(path, workspace), "utf8")).slice(0, 50_000);
      },
    }),
    workspace_list: tool({
      description: "اعرض محتويات مجلد داخل مساحات العمل.",
      inputSchema: z.object({ path: z.string().default("."), workspace: z.enum(["bench", "codex"]).default("bench") }),
      execute: async ({ path, workspace }) => {
        const fs = await import("node:fs/promises");
        return (await fs.readdir(await safePath(path, workspace), { withFileTypes: true })).map((d) => (d.isDirectory() ? d.name + "/" : d.name));
      },
    }),
    workspace_write_file: tool({
      description: "اكتب/عدّل ملفاً داخل مساحات العمل (يحفظ نسخة .bak قبل التعديل). يتطلب موافقة المستخدم.",
      inputSchema: z.object({ path: z.string(), content: z.string(), workspace: z.enum(["bench", "codex"]).default("bench") }),
      needsApproval: true,
      execute: async ({ path, content, workspace }) => {
        const fs = await import("node:fs/promises");
        const full = await safePath(path, workspace);
        await fs.copyFile(full, `${full}.bak`).catch(() => undefined);
        await fs.writeFile(full, content, "utf8");
        return `تم حفظ ${path} في ${workspace}`;
      },
    }),
    workspace_run: tool({
      description: "نفّذ أمراً داخل مساحة العمل (مثل bench migrate أو git status). الأوامر المدمرة محظورة. يتطلب موافقة المستخدم.",
      inputSchema: z.object({ command: z.string().max(500), workspace: z.enum(["bench", "codex"]).default("bench") }),
      needsApproval: true,
      execute: async ({ command, workspace }) => {
        if (BLOCKED.test(command)) return "مرفوض: أمر مدمّر لا يُنفذ تلقائياً.";
        const { exec } = await import("node:child_process");
        const cwd = workspace === "bench" ? BENCH : CODEX;
        return await new Promise<string>((resolve) =>
          exec(command, { cwd, timeout: 300_000, maxBuffer: 2_000_000 }, (err, stdout, stderr) =>
            resolve(`${err ? `exit ${err.code}\n` : ""}${stdout}${stderr}`.slice(-20_000)),
          ),
        );
      },
    }),
  };
}
