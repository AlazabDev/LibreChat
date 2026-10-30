#!/usr/bin/env bash
# يعطّل (من إعدادات GitHub، دون تعديل الملفات) workflows الخاصة بمشروع upstream
# حتى لا تستهلك دقائق Actions أو تفشل في الـ fork، ولا تتعارض عند الدمج من upstream.
# المتطلبات: gh CLI مسجَّل الدخول (gh auth login). التراجع: gh workflow enable <file>
set -euo pipefail
REPO="${1:-AlazabDev/LibreChat}"
UPSTREAM_ONLY=(
  dev-images.yml dev-branch-images.yml dev-staging-images.yml
  locize-i18n-sync.yml sync-helm-chart-tags.yml helmcharts.yml
  codegraph-e2e-vote-gate.yml codegraph-e2e-votes.yml codegraph-select.yml
  langfuse-fanout.yml promote-main.yml pr-retarget-dev.yml
  tag-images.yml main-image-workflow.yml docker-publish.yml retry-docker-builds.yml
  lighthouse.yml frontend-windows-nightly.yml playwright-bombadil.yml
)
for w in "${UPSTREAM_ONLY[@]}"; do
  if gh workflow disable "$w" -R "$REPO" 2>/dev/null; then echo "disabled  $w"; else echo "skipped   $w (غير موجود أو معطّل)"; fi
done
echo "الباقي (backend-review, client, static-checks ...) يبقى فعّالًا كفحص CI. راجع القائمة: gh workflow list -R $REPO --all"
