#!/usr/bin/env bash
# Runs the same checks as CI, in the same order, on this machine, so a push does not make GitHub the first place they run.
#   npm run verify                      (from web/)   or   bash scripts/verify.sh
#   VERIFY_SKIP_BROWSER=1 npm run verify              skips the browser tests (about 3 minutes), for a quick check
# The browser tests run the way CI runs them: software rendering (no graphics card), two workers, the @heart tests skipped.
# The tests that need the 3D picture drawn (@heart) are not part of this; run `npm run test:e2e` for those.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
PY="$ROOT/.venv/bin/python"; [ -x "$PY" ] || PY=python3
step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Model and API tests"
"$PY" -m pytest -q

cd "$ROOT/web"
step "Types"
npx tsc -b
step "Lint (an error fails; warnings do not, as in CI)"
npm run lint
step "Build"
npm run build

step "static/ matches the source"
cd "$ROOT"
if [ -n "$(git status --porcelain -- web static)" ]; then
  # uncommitted work: static/ will differ from the last commit by design, so there is nothing to compare yet
  echo "skipped: you have uncommitted changes in web/ or static/. Commit them (static/ included), then run this again for the strict check."
elif ! git diff --quiet HEAD -- static; then
  echo "FAILED: the committed static/ is out of date. Run 'npm run build' in web/ and commit static/."
  exit 1
else
  echo "ok"
fi

if [ -n "${VERIFY_SKIP_BROWSER:-}" ]; then
  step "Browser tests: skipped (VERIFY_SKIP_BROWSER)"
else
  step "Browser tests (as CI runs them: software rendering, no @heart)"
  cd "$ROOT/web"
  pkill -f "port 7861" 2>/dev/null || true
  E2E_SOFTWARE_GL=1 npm run test:e2e:ci
fi
printf '\n\033[1;32mAll checks passed.\033[0m\n'
