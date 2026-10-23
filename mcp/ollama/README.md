# Alazab Ollama → LibreChat
Verified from WSL on 2026-10-23: external HTTPS Basic auth, `/api/tags`, generation and `/v1/models` return success. Chat completions still need testing.

## Files
- `custom-endpoint.yaml`: append its single YAML array item **under** the active `endpoints.custom` array; do not replace the whole LibreChat config.
- `test-external.sh`: tests model discovery and chat completions over HTTPS.

## WSL configuration (server environment, not browser)
```bash
export OLLAMA_USER=azureuser
read -rsp 'Ollama gateway password: ' OLLAMA_PASS; echo
export OLLAMA_PASS
export OLLAMA_BASIC_AUTH="Basic $(printf '%s' "$OLLAMA_USER:$OLLAMA_PASS" | base64 -w0)"
bash mcp/ollama/test-external.sh
```
Set `OLLAMA_BASIC_AUTH` in the **LibreChat API process/container** environment as well, then merge the YAML entry into its active `librechat.yaml` and restart that application. Environment variables set only in the interactive WSL shell are not automatically inherited by existing Docker containers.

The OpenAI-compatible SDK may manage Authorization itself; verify outbound HTTP uses the Basic header and run an actual chat completion/agent tool-call before marking production ready. Do not copy plaintext passwords or generated Basic tokens into git.
