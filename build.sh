#!/usr/bin/env bash
# Install dependencies and run production builds for all publishable packages,
# in dependency order. Run from the repository root: ./build.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

build_package() {
  local rel="$1"
  local dir="$ROOT/$rel"
  echo ""
  echo "==> [$rel] npm install"
  (cd "$dir" && npm install)
  if (cd "$dir" && node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)"); then
    echo "==> [$rel] npm run build"
    (cd "$dir" && npm run build)
  else
    echo "==> [$rel] no build script (skipped)"
  fi
}

echo "UsfmTools — install and build all packages"

build_package "packages/usfm-parser"
build_package "packages/usfm-model"
build_package "packages/usfm-controls"
build_package "packages/usfm-parser-integration-tests"

echo ""
echo "Done. Libraries emit dist/ under each package; run tests from individual packages as needed."
