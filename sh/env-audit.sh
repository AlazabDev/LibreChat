#!/usr/bin/env bash
# =============================================================================
# LibreChat Environment Variable Auditor Launcher
# تشغيل أداة فحص ومقارنة متغيرات البيئة بالكود
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

command -v node >/dev/null 2>&1 || { echo "ERROR: node is required to run env-audit"; exit 1; }

node "${SCRIPT_DIR}/env-audit.js" "$@"

