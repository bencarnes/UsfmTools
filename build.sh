#!/usr/bin/env bash
# Thin wrapper kept for convenience; the build logic lives in build.ts
# (cross-platform). Equivalent to: deno task build
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
exec deno task build "$@"
