#!/usr/bin/env bash
# Type-check and test all Deno workspace packages in dependency order.
# Run from the repository root: ./build.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v deno >/dev/null 2>&1; then
  echo "Error: deno is not installed or not on PATH." >&2
  exit 1
fi

check_package() {
  local rel="$1"
  local dir="$ROOT/$rel"
  echo ""
  echo "==> [$rel] deno task check"
  (cd "$dir" && deno task check)
}

test_package() {
  local rel="$1"
  local dir="$ROOT/$rel"
  echo ""
  echo "==> [$rel] deno task test"
  (cd "$dir" && deno task test)
}

echo "UsfmTools — check and test Deno workspace packages (under packages/)"

check_package "packages/usfm-parser"
check_package "packages/usfm-model"
check_package "packages/usfm-controls"
test_package "packages/usfm-parser"
test_package "packages/usfm-model"
test_package "packages/usfm-controls"
test_package "packages/usfm-parser-integration-tests"

echo ""
echo "Done. Packages export TypeScript source via deno.json exports. Run tasks from individual packages/ paths as needed."
