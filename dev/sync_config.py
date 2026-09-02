#!/usr/bin/env python3
"""Regenerate addonismaximus/config.json from config_store.DEFAULT_CONFIG.

config.json is what Anki seeds a FRESH install with (and what the add-on's
"Config" editor shows). config_store.DEFAULT_CONFIG is what the running code
merges over. If the two drift, new users get defaults the code never intended —
which is exactly what happened before this script existed: config.json still
listed cards that had been deleted (fsrs, deckBoard, records, achievements) and
omitted pending/pace/time, so a fresh install came up with `pace` and `time`
switched on and the card order scrambled.

Run from the repo root:
    python3 dev/sync_config.py           # rewrite config.json
    python3 dev/sync_config.py --check   # exit 1 if it is out of date (CI/pre-release)
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STORE = ROOT / "addonismaximus" / "config_store.py"
TARGET = ROOT / "addonismaximus" / "config.json"


def default_config() -> dict:
    """Exec config_store.py without importing aqt (not available outside Anki)."""
    src = STORE.read_text().replace("from aqt import mw", "mw = None")
    ns: dict = {}
    exec(compile(src, str(STORE), "exec"), ns)
    return ns["DEFAULT_CONFIG"]


def main() -> int:
    want = json.dumps(default_config(), indent=2, ensure_ascii=False) + "\n"
    check = "--check" in sys.argv
    have = TARGET.read_text() if TARGET.exists() else ""
    if have == want:
        print("config.json is in sync with config_store.DEFAULT_CONFIG ✓")
        return 0
    if check:
        print("ERROR: config.json is OUT OF SYNC with config_store.DEFAULT_CONFIG.", file=sys.stderr)
        print("Run: python3 dev/sync_config.py", file=sys.stderr)
        return 1
    TARGET.write_text(want)
    print(f"rewrote {TARGET.relative_to(ROOT)} from config_store.DEFAULT_CONFIG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
