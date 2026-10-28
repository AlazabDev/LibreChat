#!/usr/bin/env bash
set -Eeuo pipefail
# Export Microsoft Foundry project metadata, agents, versions and declared tools.
# Read-only: does not modify Azure resources.
for cmd in az jq python3; do command -v "$cmd" >/dev/null || { echo "Missing command: $cmd" >&2; exit 1; }; done
: "${FOUNDRY_ACCOUNT:?Set FOUNDRY_ACCOUNT to your Foundry account name}"
: "${FOUNDRY_PROJECT:?Set FOUNDRY_PROJECT to your project name}"
OUT="${OUT:-$HOME/Reports/foundry-export/$(date +%Y%m%d-%H%M%S)}"
BASE="https://${FOUNDRY_ACCOUNT}.services.ai.azure.com/api/projects/${FOUNDRY_PROJECT}"
mkdir -p "$OUT"/{agents,connections,deployments,tools,logs}
printf 'Foundry endpoint: %s\nOutput: %s\n' "$BASE" "$OUT"
az account show --query '{subscription:id, tenant:tenantId, name:name}' -o json > "$OUT/azure-context.json"
# az rest needs the Foundry audience explicitly for these data-plane endpoints.
request() {
  local path="$1" destination="$2"
  if ! az rest --method GET --url "$BASE/$path" --resource 'https://ai.azure.com' -o json > "${destination}.tmp" 2>"$OUT/logs/az-rest-errors.log"; then
    rm -f "${destination}.tmp"
    printf 'FAIL %s (see logs/az-rest-errors.log)\n' "$path" | tee -a "$OUT/logs/failures.txt" >&2
    return 1
  fi
  mv "${destination}.tmp" "$destination"
}
request 'agents?api-version=v1' "$OUT/agents/list.json" || true
request 'connections?api-version=v1' "$OUT/connections/list.json" || true
request 'deployments?api-version=v1' "$OUT/deployments/list.json" || true
# Support common list envelopes (data/value/items) without assuming an exact layout.
if [[ -f "$OUT/agents/list.json" ]]; then
  jq -r 'if type=="array" then .[] else (.data // .value // .items // [])[] end | .name // empty' "$OUT/agents/list.json" | while IFS= read -r agent; do
    [[ -n "$agent" ]] || continue
    safe="$(printf '%s' "$agent" | tr -c 'A-Za-z0-9._-' '_')"
    mkdir -p "$OUT/agents/$safe"
    # Encode the agent name as one URL path segment.
    encoded="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$agent")"
    request "agents/$encoded?api-version=v1" "$OUT/agents/$safe/definition.json" || true
    request "agents/$encoded/versions?api-version=v1" "$OUT/agents/$safe/versions.json" || true
    if [[ -f "$OUT/agents/$safe/versions.json" ]]; then
      jq -r 'if type=="array" then .[] else (.data // .value // .items // [])[] end | .version // empty' "$OUT/agents/$safe/versions.json" | while IFS= read -r ver; do
        [[ -n "$ver" ]] || continue
        safe_ver="$(printf '%s' "$ver" | tr -c 'A-Za-z0-9._-' '_')"
        enc_ver="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$ver")"
        request "agents/$encoded/versions/$enc_ver?api-version=v1" "$OUT/agents/$safe/version-$safe_ver.json" || true
      done
    fi
  done
fi
# Extract tool definitions embedded in agent JSON; no credentials fetched.
find "$OUT/agents" -name '*.json' ! -name 'list.json' -print0 | while IFS= read -r -d '' file; do
  rel="${file#"$OUT/agents/"}"
  name="${rel//\//__}"
  jq '[.. | objects | select(has("tools")) | .tools | select(type=="array") | .[]] | unique' "$file" > "$OUT/tools/${name}" || true
done
# Build a concise manifest suitable for subsequent migration review.
python3 - "$OUT" <<'PY'
from pathlib import Path
import json,sys
p=Path(sys.argv[1]); files=list(p.rglob('*.json'))
manifest={'endpoint_type':'Microsoft Foundry project','project':p.parent.name if False else None,
          'files':[{'path':str(x.relative_to(p)),'bytes':x.stat().st_size} for x in sorted(files)]}
(p/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
PY
printf '\nExport saved: %s\n' "$OUT"
printf 'Agents files: '; find "$OUT/agents" -type f | wc -l
printf 'Tool extracts: '; find "$OUT/tools" -type f | wc -l
printf 'Failures: '; [[ -f "$OUT/logs/failures.txt" ]] && cat "$OUT/logs/failures.txt" || printf 'none\n'
