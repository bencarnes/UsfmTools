#!/usr/bin/env bash
# Install dependencies and run production builds for all publishable packages,
# in dependency order. Run from the repository root: ./build.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# npm install does NOT re-copy `file:` workspace deps once they are installed —
# the version in package.json hasn't changed, so npm assumes the local copy
# under node_modules/@usfm-tools/<pkg> is still current. After we rebuild a
# package here, downstream packages would otherwise keep serving stale dist/
# files (this bites Storybook in particular). Purge them before each install
# so the fresh dist/ from packages/* gets copied in.
purge_workspace_copies() {
  local rel="$1"
  local dir="$ROOT/$rel/node_modules/@usfm-tools"
  if [ -d "$dir" ]; then
    echo "==> [$rel] purging stale workspace copies under node_modules/@usfm-tools"
    rm -rf "$dir"
  fi
}

# Vite's dep optimizer pre-bundles `@usfm-tools/*` into node_modules/.cache/...;
# those bundles are keyed on the dep path, not its contents, so they outlive a
# fresh copy and Storybook then errors with "does not provide an export named X".
# Wipe the optimizer caches whenever we refresh the workspace copies.
purge_dev_caches() {
  local rel="$1"
  local cache_dir="$ROOT/$rel/node_modules/.cache"
  if [ -d "$cache_dir" ]; then
    echo "==> [$rel] clearing node_modules/.cache (Storybook / Vite dep cache)"
    rm -rf "$cache_dir"
  fi
}

build_package() {
  local rel="$1"
  local dir="$ROOT/$rel"
  echo ""
  purge_workspace_copies "$rel"
  purge_dev_caches "$rel"
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
build_package "packages/bible-edit"

echo ""
echo "Done. Libraries emit dist/ under each package; run tests from individual packages as needed."
