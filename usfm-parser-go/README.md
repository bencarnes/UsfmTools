# usfm-parser-go

Go rewrite of the USFM parser (port of `packages/usfm-parser`), usable as:

- a **Go library** (`github.com/usfm-tools/usfm-parser-go`) — consumed by the
  `bible-edit` Wails app for diagnostics, syntax highlighting, intellisense,
  and preview rendering
- a **standalone CLI** — `cmd/usfm`

The engine is modeled after the LSP protocol, but much simpler and tailored to
USFM editing: it keeps its own synchronized copy of each open document and
processes requests asynchronously. Integration with the editor happens through
Wails js/go bindings (regular function calls, not JSON-RPC).

This module lives at the repository root (not under `packages/`, which holds
the JS/Deno packages).

## Development

```sh
go vet ./...
go test ./...
go build ./cmd/usfm
```

Both `go vet` and `go test` also run as part of the repo-root `./build.sh`.

## Status

Scaffolding only — the lexer/parser/engine port is in progress; see the
"Rewrite parser in GO" section of `todo.md` at the repository root. This README
will grow into full architecture and protocol documentation as part of that
work.
