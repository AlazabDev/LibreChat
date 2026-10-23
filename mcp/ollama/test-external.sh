#!/usr/bin/env bash
set -euo pipefail
: "${OLLAMA_USER:?Set OLLAMA_USER}"
: "${OLLAMA_PASS:?Set OLLAMA_PASS}"
base="${OLLAMA_BASE_URL:-https://ollama.alazab.com}"
auth="Basic $(printf '%s' "${OLLAMA_USER}:${OLLAMA_PASS}" | base64 -w0)"
echo '=== HTTPS models ==='
curl --fail-with-body -sS --max-time 30 -H "Authorization: ${auth}" "${base}/v1/models" | python3 -m json.tool
echo '=== Chat completion ==='
curl --fail-with-body -sS --max-time 180 -H "Authorization: ${auth}" -H 'Content-Type: application/json' "${base}/v1/chat/completions" -d '{"model":"llama3.1:8b-instruct-fp16","messages":[{"role":"user","content":"Reply TEST_OK"}],"stream":false}' | python3 -m json.tool
