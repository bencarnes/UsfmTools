# USFM editor typing performance

Fixes to reduce lag when editing large books (e.g. Psalms), especially with the preview pane open.

## Todo

- [x] **Stop full parsing in `UsfmPane` on every keystroke** — `firstBookFromUsfm` calls `parse(usfm)` whenever `value` changes (~16 ms on Psalms). Replace with a lightweight `\c` marker scan, cached/incremental marker list, or debounced refresh separate from editor `onChange`.
- [x] **Stop lifting the full document string to React on every keystroke** — keep document state in CodeMirror; debounce or ref-sync to the workspace model for save/dirty tracking only.
- [x] **Unify validation** — share one debounced full-document parse between the CodeMirror linter and the shell errors panel instead of two independent parses (~250–300 ms apart).
- [x] **Pause scroll sync while typing** — defer split-pane scroll sync until typing idle, or sync only on explicit scroll; avoid `querySelectorAll` over the full preview DOM every ~120 ms while the cursor moves.
- [x] **Incremental syntax highlighting** — avoid full-document lexer passes and decoration rebuilds on every pause; scope to viewport or use incremental tokenization.

## Context

Preview HTML regeneration is debounced (1.5 s) in split mode. Scroll sync is paused during typing and resumes after 500 ms idle. Workspace model updates are debounced (500 ms) while dirty state is marked immediately; save flushes the editor buffer first. Syntax highlighting classifies only the visible viewport (plus a few lines of margin). Validation runs once per typing pause (300 ms) in the shell and feeds both the errors panel and editor squiggles.

## Key files

- `packages/usfm-controls/src/components/usfm-pane/UsfmPane.tsx`
- `packages/usfm-controls/src/components/usfm-editor/UsfmEditor.tsx`
- `packages/usfm-controls/src/components/usfm-editor/codemirror-usfm.ts`
- `packages/usfm-controls/src/components/usfm-shell/UsfmShell.tsx`
- `packages/usfm-controls/src/components/usfm-pane/scroll-sync.ts`

# Rewrite parser in GO

I want to rewrite the USFM parser using GO lang. I want to keep the old parser for reference, but not include it in the final build. I want the new parser to be runnable as a standalone CLI tool and also includable as a GO library. I want the bible-edit app to include that library use it to find errors, do syntax highlighting, and provide intellisense (basically things the old parser is used for). I want the new parser to be modeled after the way the LSP protocol works except much simpler and tailored to the needs of USFM editing (e.g. we don't need a go-to-definition feature). Like the LSP protocol, the new parser engine should keep a copy of the text and stay in sync with the editor. Like the LSP, the new parser engine should run asynchronously. Unlike the LSP protocol, the new parser engine be integrated with the editor via the js/go integration mechanism in Wails and via regular function calls (not JSON-RPC).

I want the new parser engine to have good unit tests and good documentation in a README.md.

Ask clarifying questions as needed.

## Todo

### Scaffolding

- [x] **Create the Go module** — new Go module at `usfm-parser-go/` (top-level; `packages/` is for JS packages) separate from the `bible-edit` app so it is usable as a standalone library. Layout: `pkg/` (or root packages) for the library, `cmd/usfm/` for the CLI. Wire `go vet` / `go test` into `build.sh`.
- [x] **Keep the old TS parser for reference only** — leave `packages/usfm-parser/` in the repo but remove it from the workspace build/check/test pipeline (and eventually from `usfm-controls`/`usfm-model` imports) so it is not part of the final build. _Done: excluded from `build.sh` and root `deno.json` check/test tasks; README banner added. It stays a workspace member so remaining imports resolve; dropping it from the final app bundle happens when the "Switch features over" / preview-rendering items remove the last imports._

### Core parser (Go library)

- [x] **Port the grammar** — translate `packages/usfm-parser/src/grammar.ts` (marker definitions, nesting rules, attributes) into Go data structures. _Done: `usfm-parser-go/grammar/` with all grammar.test.ts cases ported._
- [x] **Port the lexer** — tokenizer equivalent to `lexer.ts`, producing tokens with byte/UTF-16 position info suitable for editor integration. _Done: `usfm-parser-go/lexer/`; all lexer.test.ts cases ported plus UTF-16 tests; token streams verified byte-identical to the TS lexer across all 66 BSB books (differential tool kept at `internal/lexdump`)._
- [x] **Port the parser and AST types** — equivalent of `parser.ts` / `types.ts`; error-tolerant parsing (never panic on malformed input, collect diagnostics instead). _Done: `usfm-parser-go/parser/` + flat `Node` AST in the root package; all parser.test.ts cases ported; ASTs and error lists verified identical to the TS parser across all 66 BSB books (`internal/astdump`)._
- [x] **Diagnostics** — structured errors/warnings with ranges and codes, matching what `language-service/diagnostics.ts` surfaces today. _Done: `usfm-parser-go/diagnostics/` plus diagnostic codes on `ParseError`; verified against the TS `getDiagnostics` on synthetic inputs (columns differ only where the TS lexer's attribute-rewind bug misreports positions — Go is correct there)._
- [x] **Unit tests** — table-driven tests for lexer, parser, and diagnostics; port the existing TS parser test cases; run the Berean Standard Bible corpus tests (`packages/usfm-parser-integration-tests/`) against the Go parser. _Done: unit tests landed with each ported package; corpus tests ported to `usfm-parser-go/integration/` (all 66 books, zero errors, full Bible parses in ~0.25 s). Includes `BenchmarkParsePsalms` (~24 ms, ~80k allocs on the dev machine — similar to TS's ~16 ms; allocation-reduction headroom exists if the perf revisit needs it)._

### Engine (LSP-like, simplified)

- [x] **Document store with sync** — engine keeps its own copy of each open document; API modeled on LSP lifecycle: `Open`, `ApplyChanges` (incremental edits with ranges + version numbers), `Close`. _Done: `usfm-parser-go/engine/store.go`; edits are `{from,to,text}` batches in UTF-16 offsets addressing the pre-batch document (CodeMirror `iterChanges` convention), version-gated, atomic on error, mutex-guarded (tested with `-race`)._
- [x] **Async processing** — parsing/analysis runs off the caller's goroutine; results are versioned so stale results can be discarded; debounce/coalesce rapid edits. _Done: `usfm-parser-go/engine/engine.go`; per-document worker goroutine, capacity-1 dirty signal coalesces edits (always analyzes the latest snapshot), optional debounce window, version-stamped `Analysis` (AST + diagnostics) delivered via `OnAnalysis` with monotonic versions — stale results are dropped, close discards in-flight work._
- [x] **Feature requests** — tailored to USFM editing needs (no go-to-definition): diagnostics (push or pull), semantic tokens / syntax classification for a range or viewport (replaces `language-service/classifier.ts`), completions for markers and book codes (replaces `language-service/completions.ts`), and whatever else `language-service/service.ts` currently provides (e.g. chapter/verse structure for the outline/preview). _Done: `engine/features.go` — `Diagnostics` (pull; push already via `OnAnalysis`), `Classify`/`ClassifyRange`, `Completions` (markers ported + book codes added), `Structure` (book/chapter outline replacing usfm-model's chapter listing). Classifier verified byte-identical to TS across the BSB corpus (`internal/classdump`)._
- [ ] **Engine unit tests** — cover document sync (out-of-order versions, incremental edits), cancellation/staleness, and each feature request.

### CLI tool

- [ ] **`usfm` CLI** — standalone binary using the library: at minimum `check` (parse a file/dir, print diagnostics, non-zero exit on errors); consider `parse --json` for AST dumps to help debugging and test fixtures.

### Wails integration (bible-edit)

- [ ] **Bind the engine into the app** — add the engine to `apps/bible-edit` (Go dependency on the parser module, e.g. via `go.work` or a replace directive), expose bound methods on the app struct (regular function calls, not JSON-RPC), and push async results (diagnostics) to the frontend via Wails events.
- [ ] **Frontend adapter** — implement the `usfm-controls` `language-service/protocol.ts` interface backed by the Wails bindings, keeping editor edits in sync with the engine (forward CodeMirror change sets as incremental updates).
- [ ] **Switch features over** — errors panel + squiggles, syntax highlighting, and intellisense/completions in the editor all served by the Go engine; remove the TS parser from the `usfm-controls`/`usfm-model` runtime paths.
- [ ] **Preview HTML rendering via the Go engine** — move `usfm-model`'s preview rendering (`render-preview-html.ts`) and the other `usfm-model` parser consumers (chapter lists, book picker) onto the new parser, e.g. an engine request that returns preview HTML (or the structure needed to render it) for the current document.

### Docs & cleanup

- [ ] **README.md for the Go module** — architecture overview (library / engine / CLI), the LSP-like protocol (document sync, versioning, feature requests), how to use it as a library, CLI usage, and how bible-edit integrates it.
- [ ] **Update repo docs** — `AGENTS.md` / root `README.md`: new package layout, Go toolchain requirement, build commands.

### Performance revisit

- [ ] **Re-evaluate the existing debounce/throttle layers** — the perf work above (see "USFM editor typing performance") added debouncing because parsing was synchronous and on the UI thread: 300 ms validation debounce, 500 ms workspace model sync, 1.5 s preview HTML regeneration, scroll-sync pause while typing, viewport-only highlighting. With parsing async in Go, decide per feature whether the debounce still earns its latency or should shrink/go away.
- [ ] **Prefer engine-side coalescing over frontend debouncing** — forward edits to the engine immediately (cheap sync of the document copy) and let the engine coalesce/cancel stale parses by version; the frontend then just applies whatever versioned results arrive, instead of gating requests with timers.
- [ ] **Watch the new costs asynchrony introduces** — Wails bridge call overhead per keystroke, serialization of large results (semantic tokens, preview HTML), and stale-result flicker (e.g. squiggles or highlights lagging the text); batch or range-scope results where needed.
- [ ] **Verify performance end-to-end** — profile typing in large books (e.g. Psalms) with the Go engine doing validation/highlighting/preview; confirm it's at least as smooth as the tuned TS setup before deleting the old optimizations.

### Follow-ups

- [ ] **Reduce Go parser allocations if the perf revisit needs it** — `BenchmarkParsePsalms` shows ~24 ms / ~80k allocs for Psalms on the dev machine, comparable to (not faster than) the TS parser's ~16 ms. The port inherits the TS design's allocation patterns: a token struct per lexeme, a node per text run, string concatenation when merging text tokens, and a fresh map per attributed node. Off-UI-thread parsing makes this tolerable, but if lower latency is wanted (e.g. for per-keystroke incremental reparses), profile and consider: preallocating the token slice, building merged text via `strings.Builder` or source slicing, pooling nodes, and lazy attribute maps. Tie into the "Verify performance end-to-end" item. — the Go parser port reproduces these faithfully (verified identical on the BSB corpus; also noted in the `parser` package comment): text after a chapter number is silently dropped (`\c 1 extra` loses "extra"); `\fig` in inline context (e.g. inside a paragraph) is reported as "Unknown marker" instead of being parsed as a figure; note-caller splitting collapses interior whitespace in the note's first text run and keeps a trailing space before the end marker (see `TestNoteTextKeepsTrailingSpace`). Decide per quirk whether it's correct USFM handling or a bug; fix in both parsers or document as intentional.
- [ ] **Investigate suspected typos carried over from the TS grammar** — the grammar port copied two oddities faithfully rather than fixing them silently: the cell list has `tch12` where the pattern suggests `thc12` should be, and `wl` has a default attribute (`lang`) but appears in no category (so it's `unknown`). Check against the USFM 3.x spec and fix both `grammar.ts` and `usfm-parser-go/grammar/grammar.go` (or document why they're intentional).

## Key files

- `packages/usfm-parser/src/{grammar,lexer,parser,types}.ts` — old parser to port
- `packages/usfm-controls/src/language-service/` — existing LSP-like TS layer (protocol, service, diagnostics, classifier, completions) to be backed by the Go engine
- `packages/usfm-model/src/` — other consumers of the old parser (preview rendering, chapter lists, book picker)
- `packages/usfm-parser-integration-tests/` — Berean corpus tests to port
- `apps/bible-edit/{main.go,app.go}` — Wails app where the engine gets bound

