#!/usr/bin/env bash
# Build the AnkiWeb upload package for Addonis Maximus.
#
# The upload zip is the CONTENTS of addonismaximus/ — __init__.py must sit at the
# ZIP ROOT, not inside an addonismaximus/ folder. Nothing under dev/ ships.
#
#   ./dev/package.sh            build upload.zip
#   ./dev/package.sh --check    run the pre-flight gates only, build nothing
#
# Upload the result at ankiweb.net -> Share -> Upload (add-on #306644033).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/addonismaximus"
STAGE="$ROOT/upload"
ZIP="$ROOT/upload.zip"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$1" >&2; exit 1; }

say "1/5  config.json is in sync with config_store.DEFAULT_CONFIG"
python3 "$ROOT/dev/sync_config.py" --check || fail "config.json is stale — run: python3 dev/sync_config.py"

say "2/5  data-layer tests"
python3 "$ROOT/dev/web-src/test_data.py" >/dev/null || fail "dev/web-src/test_data.py failed"
python3 "$ROOT/dev/web-src/test_core.py" >/dev/null || fail "dev/web-src/test_core.py failed"
echo "test_data.py + test_core.py passed"

say "3/5  committed bundle matches source"
( cd "$ROOT/dev/web-src" && npm run build --silent >/dev/null ) || fail "esbuild build failed"
if ! git -C "$ROOT" diff --quiet -- addonismaximus/web/addonismaximus.js; then
  fail "addonismaximus/web/addonismaximus.js changed on rebuild — commit the rebuilt bundle first"
fi
echo "bundle is current and committed"

say "4/5  no stray runtime artifacts in the add-on folder"
strays="$(find "$SRC" \( -name meta.json -o -name '*.log' -o -name '__pycache__' -o -name '.DS_Store' -o -name '*.pyc' \) -print)"
[[ -n "$strays" ]] && echo "found (these are excluded from the zip, not an error):" && echo "$strays"

if [[ $CHECK_ONLY -eq 1 ]]; then say "pre-flight OK (--check: nothing packaged)"; exit 0; fi

say "5/5  staging + zipping"
rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"
# Copy the add-on, dropping everything Anki generates at runtime and the dev-only
# preview page (web/index.html is only used by dev/web-src/server.mjs).
rsync -a \
  --exclude 'meta.json' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude 'web/index.html' \
  "$SRC"/ "$STAGE"/

[[ -f "$STAGE/__init__.py" ]] || fail "__init__.py missing from staging root"
[[ -f "$STAGE/web/addonismaximus.js" ]] || fail "built bundle missing from staging"
ls "$STAGE"/web/fonts/*.woff2 >/dev/null 2>&1 || fail "fonts missing from staging"

( cd "$STAGE" && zip -r -q -X "$ZIP" . )
rm -rf "$STAGE"

say "package ready: $(basename "$ZIP")  ($(du -h "$ZIP" | cut -f1))"
unzip -l "$ZIP"
echo
echo "Upload at: https://ankiweb.net/shared/info/306644033  ->  Share -> Upload"
