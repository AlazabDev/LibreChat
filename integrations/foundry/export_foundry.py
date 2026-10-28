import os
import json
import sys
from pathlib import Path

from azure.identity import AzureCliCredential
from azure.ai.projects import AIProjectClient

ROOT = Path(__file__).resolve().parent

endpoint = (
    os.getenv("PROJECT_ENDPOINT")
    or os.getenv("AZURE_AI_PROJECT_ENDPOINT")
)

if not endpoint:
    sys.exit("ERROR: PROJECT_ENDPOINT is not configured")

client = AIProjectClient(
    endpoint=endpoint,
    credential=AzureCliCredential()
)

def save(folder, name, data):
    path = ROOT / folder / name
    path.write_text(
        json.dumps(
            data,
            indent=2,
            ensure_ascii=False,
            default=str
        ),
        encoding="utf-8"
    )
    print(f"EXPORTED: {path.relative_to(ROOT)}", flush=True)

def serialize(item):
    if hasattr(item, "model_dump"):
        return item.model_dump(mode="json")
    if hasattr(item, "as_dict"):
        return item.as_dict()
    return item

def export_collection(folder, operation):
    print(f"\n=== {folder.upper()} ===", flush=True)
    try:
        entries = [serialize(item) for item in operation()]
        save(folder, "index.json", entries)
        print(f"TOTAL: {len(entries)}", flush=True)
        return entries
    except Exception as exc:
        print(f"FAILED [{folder}]: {exc}", flush=True)
        return None

models = export_collection(
    "models",
    client.deployments.list
)

agents = export_collection(
    "agents",
    client.agents.list
)

toolboxes = export_collection(
    "tools",
    client.toolboxes.list
)

if agents is not None:
    for agent in agents:
        name = agent.get("name", "unknown")
        version = agent.get("version")
        safe = "".join(
            c if c.isalnum() or c in "-_." else "_"
            for c in str(name)
        )
        try:
            detail = client.agents.get(
                agent_name=name,
                **({"agent_version": version} if version else {})
            )
            save(
                "agents",
                f"{safe}.json",
                serialize(detail)
            )
        except Exception as exc:
            print(f"AGENT DETAIL FAILED [{name}]: {exc}", flush=True)

result = {
    "models": None if models is None else len(models),
    "agents": None if agents is None else len(agents),
    "toolboxes": None if toolboxes is None else len(toolboxes)
}

save(".", "export-summary.json", result)

if any(value is None for value in result.values()):
    sys.exit(1)

print("\nEXPORT COMPLETED", flush=True)