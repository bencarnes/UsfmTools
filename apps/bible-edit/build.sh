#!/usr/bin/env bash
# Build BibleEdit (Wails desktop app). Run from apps/bible-edit or repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PATH="${HOME}/go/bin:${PATH}"

echo "==> frontend npm install"
(cd frontend && npm install)

echo "==> frontend production bundle"
(cd frontend && npm run build)

TAGS=()
if [[ "$(uname -s)" == "Linux" ]] && ! pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
  if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
    TAGS=(-tags webkit2_41)
    echo "==> using Go build tag webkit2_41 (WebKitGTK 4.1)"
  fi
fi

echo "==> wails build"
wails build "${TAGS[@]}"

echo "Built: $ROOT/build/bin/BibleEdit"
