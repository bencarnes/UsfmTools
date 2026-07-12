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

if ! command -v go >/dev/null 2>&1; then
  echo "Error: go is not installed or not on PATH (needed for usfm-parser-go)." >&2
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

# Ladle (optional dev tooling) may create a workspace node_modules/ directory.
# Remove it so Deno resolves npm: imports from its cache without invoking npm.
rm -rf "$ROOT/node_modules" "$ROOT"/packages/*/node_modules

check_package "packages/usfm-parser"
check_package "packages/usfm-model"
check_package "packages/usfm-controls"
test_package "packages/usfm-parser"
test_package "packages/usfm-model"
test_package "packages/usfm-controls"
test_package "packages/usfm-parser-integration-tests"

echo ""
echo "==> [usfm-parser-go] go vet"
(cd "$ROOT/usfm-parser-go" && go vet ./...)
echo ""
echo "==> [usfm-parser-go] go test"
(cd "$ROOT/usfm-parser-go" && go test ./...)

echo ""
echo "Done. Packages export TypeScript source via deno.json exports. Run tasks from individual packages/ paths as needed."
