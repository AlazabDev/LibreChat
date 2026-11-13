#!/usr/bin/env bash
# =============================================================================
# Alazab Foundry Inventory Script Wrapper
# منظومة العزب — مشغل سكربت الجرد الشامل لمنصة Azure AI Foundry
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

node scripts/foundry-inventory.mjs "$@"

