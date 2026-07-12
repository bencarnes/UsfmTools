# usfm-parser-go

A Go parser and editing engine for [USFM](https://ubsicap.github.io/usfm/)
(Unified Standard Format Markers) scripture text. It is a faithful rewrite of
the repository's original TypeScript parser (`packages/usfm-parser`, now kept
for reference only) and serves three roles:

- a **Go library** — parse USFM, compute editor diagnostics, classify tokens
  for syntax highlighting, complete markers/book codes, and render
  publication-style preview HTML
- an **editing engine** — an LSP-like, asynchronous service that keeps a
  synchronized copy of each open document and analyzes it off the caller's
  thread (this is what the `bible-edit` Wails app embeds)
- a **standalone CLI** — `usfm check` and `usfm parse` (`cmd/usfm`)

The module lives at the repository root (not under `packages/`, which holds
the JS/Deno packages). Module path: `github.com/usfm-tools/usfm-parser-go`
(consumed via a `replace` directive; it is not published).

## Package layout

| Package | Purpose |
|---|---|
| `.` (root, `usfm`) | Shared types: `Position`, `Range`, `Node` (AST), `ParseError`, `ParseResult`, `Diagnostic` + severity/codes |
| `grammar` | Marker grammar: categories, paragraph/char/note groupings, default attribute names |
| `lexer` | Tokenizer with byte + UTF-16 position tracking |
| `parser` | Error-tolerant parser producing the AST (`Parse`, `ParseStrict`) |
| `diagnostics` | Converts parse errors to editor diagnostics with source ranges |
| `preview` | Publication view model + HTML renderer (`BuildPreview`, `Render`) |
| `engine` | The LSP-like engine: document store, async analysis, feature requests |
| `cmd/usfm` | CLI tool |
| `integration` | Berean Standard Bible corpus tests and benchmarks |
| `internal/*dump` | Differential-testing tools (see [Testing](#testing)) |

## Positions and offsets

Editor integration drives the position model. Every `Position` carries:

- `Line`, `Column` — 0-based; columns in **UTF-16 code units**
- `Offset` — 0-based offset from the document start in **UTF-16 code units**,
  i.e. a JavaScript string index, and therefore directly a CodeMirror
  document position
- `Byte` — offset into the UTF-8 source, for slicing on the Go side

UTF-16 everywhere the frontend looks means values cross the Wails bridge
without conversion. String handling (whitespace splitting, trimming) matches
JavaScript semantics rather than Go's, so documents with BOMs or exotic
Unicode spaces behave identically to the original TS parser.

## Library usage

Parse and inspect the AST:

```go
import (
    "github.com/usfm-tools/usfm-parser-go/parser"
)

result := parser.Parse(source) // never panics; malformed input yields Errors
for _, book := range result.Document.Children {
    fmt.Println(book.Code) // "GEN", …
}
for _, e := range result.Errors {
    fmt.Printf("%s at %d:%d [%s]\n", e.Message, e.Position.Line, e.Position.Column, e.Code)
}
```

The AST is a single flat `Node` struct with a `Type` discriminator
(`document`, `book`, `chapter`, `verse`, `paragraph`, `char`, `note`,
`table`, `row`, `cell`, `milestone`, `figure`, `sidebar`, `optbreak`,
`text`, `ref`, `unknown`); type-specific fields are zero-valued elsewhere.
It serializes cleanly to JSON (and across the Wails bridge).

Editor diagnostics (range-carrying problems rather than raw parse errors):

```go
import "github.com/usfm-tools/usfm-parser-go/diagnostics"

diags := diagnostics.Compute(source)            // parses internally
diags  = diagnostics.FromParseResult(source, r) // reuse an existing parse
```

Preview HTML (publication-style reading layout):

```go
import "github.com/usfm-tools/usfm-parser-go/preview"

html := preview.Render(source, preview.Options{VersePerLine: true})
```

Parse errors surface as a banner `<aside>` before the document; all
user-supplied text is escaped. Styling happens entirely through the emitted
`usfm-*` class hooks (`usfm-line`, `usfm-v`, `usfm-chapter`, `usfm-note`, …).

## The engine (LSP-like, simplified)

`engine.Engine` is modeled on the Language Server Protocol's document
lifecycle, but much simpler and tailored to USFM editing — there is no
go-to-definition, no JSON-RPC, no capability negotiation. Like an LSP server
it owns a copy of every open document, keeps it in sync through incremental
edits, and runs analysis asynchronously; unlike LSP it is called through
plain Go function calls (in bible-edit: Wails js/go bindings).

### Document sync

```go
eng := engine.New(engine.Options{
    OnAnalysis: func(a engine.Analysis) { /* push diagnostics somewhere */ },
})
defer eng.Shutdown()

eng.Open("file.usfm", 1, text)
eng.ApplyChanges("file.usfm", 2, []engine.Change{{From: 10, To: 12, Text: "x"}})
eng.Close("file.usfm")
```

- **Versioning** — every state of a document has a version chosen by the
  caller; `ApplyChanges` must carry a version greater than the current one,
  and out-of-order batches are rejected with `ErrStaleVersion` (the document
  is left unchanged on any error).
- **Edit batches** — a `Change` is `{From, To, Text}` with offsets in UTF-16
  code units addressing the document *as it was before the whole batch* —
  the convention of CodeMirror's `ChangeSet.iterChanges`, so editor change
  sets forward without translation. Batches are sorted ascending and
  non-overlapping; an empty batch is a plain version bump.

### Async analysis

Each open document has one worker goroutine. Edits mark the document dirty;
the worker always analyzes the **latest** snapshot, so rapid edits coalesce
naturally (intermediate versions are skipped, no timers needed — an optional
`Options.Debounce` window exists but bible-edit runs without one). Results
are version-stamped `Analysis` values (AST + diagnostics) delivered through
`Options.OnAnalysis` with strictly increasing versions per document; stale
results are dropped, and closing a document discards in-flight work. All
methods are safe for concurrent use (the suite runs under `-race`).

### Feature requests

Pull-style requests, each returning the analyzed/current document version so
callers can detect lag:

| Method | Serves |
|---|---|
| `Diagnostics(id)` | errors panel / squiggles (also pushed via `OnAnalysis`) |
| `Classify(id)`, `ClassifyRange(id, from, to)` | syntax highlighting (viewport-scoped) |
| `Completions(id, line, column)` | intellisense: markers after `\`, book codes in `\id` |
| `Structure(id)` | book/chapter outline (navigator, scroll sync) |
| `RenderPreview(id, opts)` | preview HTML of the engine's current copy |

`Diagnostics` and `Structure` reuse the latest analysis (they only parse
synchronously if called before the first background analysis lands);
classification and completions operate directly on the synced text, and
range classification widens to the enclosing line so verse/chapter numbers
stay correct.

## CLI

```
go build ./cmd/usfm       # or: go run ./cmd/usfm …

usfm check [path ...]     # parse files and report diagnostics
usfm parse [-compact] <file>  # dump AST + errors as JSON
```

`check` accepts `.usfm` files, directories (walked recursively), or `-` for
stdin, and prints compiler-style lines — `file:line:col: error: message
[code]` (1-based, UTF-16 columns) — exiting 1 when error diagnostics were
found and 2 on usage/I-O problems. `parse` prints the full `ParseResult`
(AST with positions, plus errors) as JSON and always exits 0 when parsing
ran; use `check` to gate on errors.

## How bible-edit integrates it

```
CodeMirror editor ──change sets──▶ DocumentSync (usfm-controls, TS)
        ▲                               │ openDocument/applyChanges/closeDocument
        │ squiggles, tokens,            ▼
        │ completions, preview   UsfmService (apps/bible-edit/usfm.go, Wails bindings)
        │                               │ plain function calls
   usfm:analysis events                 ▼
        └────────────────────── engine.Engine (this module)
```

- `apps/bible-edit/go.mod` depends on this module via a `replace` directive
  pointing at `../../usfm-parser-go`.
- `UsfmService` (bound alongside the app struct) exposes the lifecycle and
  feature methods 1:1, plus stateless `RenderPreviewText` (the preview
  renders debounced snapshots and must work when no editor — and therefore
  no engine document — is mounted).
- Fresh analyses are pushed to the frontend as the `usfm:analysis` Wails
  event carrying `{id, version, diagnostics}`; the AST never crosses the
  bridge.
- On the frontend, `createWailsLanguageClient()`
  (`apps/bible-edit/frontend/src/language-client.ts`) implements the
  `UsfmLanguageClient` protocol from `@usfm-tools/controls`, and each
  mounted editor syncs its document through `DocumentSync` (ordered queue,
  monotonic versions, self-healing reopen if an update is rejected).

Components fall back to an in-process TypeScript client when no engine is
injected (component stories, tests), so `usfm-controls` remains usable
without Go.

## Development

```sh
go vet ./...
go test ./...        # unit + corpus tests
go test -race ./engine/  # the engine suite is designed to pass under -race
go build ./cmd/usfm
```

Both `go vet` and `go test` also run as part of the repo-root `./build.sh`.

## Testing

Three layers keep the port honest:

1. **Unit tests** per package, ported from the TS test suites (grammar,
   lexer, parser, diagnostics, preview, engine, CLI) plus Go-side additions
   (UTF-16 edge cases, concurrency/staleness, `-race`).
2. **Corpus tests** (`integration/`): all 66 books of the Berean Standard
   Bible (`bibles/bsb/usfm`) parse with zero errors; the full Bible parses
   in ~0.25 s. `BenchmarkParsePsalms` tracks single-book latency on the
   largest book.
3. **Differential verification** against the TS implementation across the
   whole corpus, byte-for-byte: token streams (`internal/lexdump`),
   normalized ASTs + error lists (`internal/astdump`), syntax
   classifications (`internal/classdump`), and preview HTML in both
   verse-per-line modes (`internal/previewdump`). Each tool dumps
   normalized output for every corpus file; a matching Deno script does the
   same with the TS code and the outputs are diffed.

## Fidelity notes

The port reproduces the TS parser's behavior exactly, including a few
inherited quirks kept deliberately so the differential tests stay
meaningful (e.g. text after a chapter number is dropped, `\fig` in inline
context reports as an unknown marker). They are catalogued in the
"Follow-ups" section of the repository `todo.md`, to be fixed in both
parsers or documented as intentional. Diagnostic *codes*
(`unknown-marker`, `unexpected-end-marker`, `unattached-attribute`) and
byte offsets are Go-side additions the TS parser never had.
