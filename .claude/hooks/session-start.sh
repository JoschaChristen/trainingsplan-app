#!/bin/bash
# Installs npm dependencies at the start of a Claude Code cloud session so that
# typecheck, lint, unit and e2e tests can run right away. Local sessions are skipped.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Install only if this script or the npm manifests changed since the last
# successful install. The hash file lives in node_modules (git-ignored).
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  # npm install (not npm ci) keeps the cached node_modules of the container.
  npm install --no-audit --no-fund
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi

# Playwright browsers are not installed here: cloud containers ship Chromium for
# the pinned @playwright/test version. Do not run `playwright install`.
