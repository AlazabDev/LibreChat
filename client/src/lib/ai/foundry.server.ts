import { createOpenAI } from "@ai-sdk/openai";

// Microsoft Foundry agent (az-agent-copilot). Auth: Entra service principal (client credentials).
export const FOUNDRY_ENDPOINT = "https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway";

let cached: { token: string; exp: number } | undefined;

export function foundryConfigured() {
  return Boolean(process.env["AZURE_TENANT_ID"] && process.env["AZURE_CLIENT_ID"] && process.env["AZURE_CLIENT_SECRET"]);
}

async function getToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const tenant = process.env["AZURE_TENANT_ID"]!;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env["AZURE_CLIENT_ID"]!,
      client_secret: process.env["AZURE_CLIENT_SECRET"]!,
      scope: "https://ai.azure.com/.default",
    }),
  });
  if (!res.ok) throw new Error(`Foundry auth failed [${res.status}]: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

// Responses API provider that targets the Foundry agent instead of a raw model.
export function foundryProvider(agentName: string, version?: string) {
  if (!/^az-agent-[a-z0-9-]+$/.test(agentName)) throw new Error("Invalid Foundry agent name");
  if (version && !/^[0-9]+$/.test(version)) throw new Error("Invalid Foundry agent version");
  return createOpenAI({
    baseURL: `${FOUNDRY_ENDPOINT}/openai/v1`,
    apiKey: "entra",
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${await getToken()}`);
      let body = init?.body ?? null;
      if (typeof body === "string") {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        delete parsed["model"];
        parsed["agent"] = { name: agentName, ...(version ? { version } : {}), type: "agent_reference" };
        body = JSON.stringify(parsed);
      }
      const res = await fetch(input, { ...init, headers, body });
      if (!res.ok) console.error(`Foundry request failed [${res.status}]`);
      return res;
    },
  });
}
