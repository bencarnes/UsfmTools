# usfm-parser-go

A Go parser and editing engine for [USFM](https://ubsicap.github.io/usfm/)
(Unified Standard Format Markers) scripture text. It began as a faithful
rewrite of the repository's original TypeScript parser (since removed) and is
now the only USFM parser in the repository. It serves three roles:

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
Unicode spaces behave as they did in the original TS parser.

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

The AST is a single flat `Node` struct with a `Type` discriminator;
type-specific fields are zero-valued elsewhere. It serializes cleanly to JSON
(and across the Wails bridge). See [The AST](#the-ast) for the node types and
[Parsing USFM](#parsing-usfm) for how source maps onto them.

Strict mode stops at the first problem instead of collecting errors. It
returns that error plus the partial result (nodes still being built when it
stopped are not attached):

```go
result, err := parser.ParseStrict(`\id GEN` + "\n" + `\v 1 \zzz bad marker`)
// err: parse error at 1:5: Unknown marker '\zzz'
```

The lexer and grammar are usable on their own:

```go
import (
    "github.com/usfm-tools/usfm-parser-go/grammar"
    "github.com/usfm-tools/usfm-parser-go/lexer"
)

for _, t := range lexer.Tokenize(`\v 1 In the beginning`) {
    fmt.Println(t.Type, t.Value, t.Position.Offset)
}

grammar.Category("p")       // grammar.VersePara
grammar.IsParaMarker("q1")  // true
grammar.IsCharMarker("nd")  // true
grammar.IsNoteMarker("f")   // true
grammar.DefaultAttribute("w") // "lemma", true
```

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

Parse errors are not rendered (they are reported as diagnostics); all
user-supplied text is escaped. Styling happens entirely through the emitted
`usfm-*` class hooks (`usfm-line`, `usfm-v`, `usfm-chapter`, `usfm-note`, …).

## USFM terminology

USFM ([3.1 docs](https://docs.usfm.bible/usfm/3.1.1/index.html)) marks up
scripture with **markers**: backslash-prefixed tags such as `\p`, `\v` and
`\nd`. This section defines the terms used in the rest of this README and in
the code.

### Markers

| Form | Example | Meaning |
|---|---|---|
| Opening marker | `\nd` | Starts an element |
| End (closing) marker | `\nd*` | Ends a paired element |
| Nested marker | `\+nd` … `\+nd*` | A character element opened inside another character element |

```usfm
\p \v 1 The \nd Lord\nd* spoke to Moses.
```

`\p` starts a paragraph, `\v 1` marks where verse 1 begins, and `\nd…\nd*`
wraps "Lord" (the divine name).

### Categories

Every marker has a **category** (`grammar.Category`), which decides where it
may appear and how it is closed. The marker lists live in
`grammar/grammar.go` (`categoryDefinitions`), which follows the USFM 3.x
stylesheets. Markers not listed there are `unknown`.

**Paragraph-level** (`MarkerCategory.IsPara`). These start a block. A new
paragraph-level marker implicitly closes the current one; there is no `\p*`.

| Category | Examples | Description |
|---|---|---|
| `header` | `\h`, `\toc1`, `\ide` | Book header metadata |
| `title` | `\mt1`, `\mt2` | Main titles |
| `introduction` | `\ip`, `\imt1`, `\io1` | Introductory material |
| `sectionpara` | `\s1`, `\ms`, `\r`, `\mr`, `\cl` | Section headings and references |
| `versepara` | `\p`, `\m`, `\q1`, `\pi1`, `\b` | Prose and poetry paragraphs that carry verse text |
| `list` | `\li1`, `\lh`, `\lf` | List entries |
| `otherpara` | `\rem`, `\lit`, `\pb`, `\sts` | Miscellaneous paragraphs |

```usfm
\s1 The Creation
\p \v 1 In the beginning God created the heavens and the earth.
\q1 \v 2 The earth was formless and void,
\q2 and darkness was over the deep.
```

`\p` implicitly closes `\s1`, and `\q1` closes `\p`.

**Character-level** (`IsChar`). These style or annotate an inline span inside
a paragraph or note.

| Category | Examples | Description |
|---|---|---|
| `char` | `\nd`, `\wj`, `\bk`, `\w`, `\it`, `\bd`, `\jmp`, `\wl` | General character styles |
| `footnotechar` | `\fr`, `\ft`, `\fq`, `\fqa` | Structure within footnotes |
| `crossreferencechar` | `\xo`, `\xt`, `\xq` | Structure within cross-references |
| `introchar` | `\ior`, `\iqt` | Character styles in introductions |
| `listchar` | `\lik`, `\litl`, `\liv1` | Character styles in lists |

`char`, `introchar` and `listchar` spans end at their own `\marker*`.
Footnote and cross-reference chars are implicitly closed by the next
note char or by the note's end marker, so `\fr*` and `\ft*` are optional:

```usfm
\v 1 In the beginning\f + \fr 1:1 \ft Or "At the start"\f* God created…
```

**Notes** (`IsNote`). These wrap a footnote or cross-reference, which
contains note chars.

| Category | Examples | Description |
|---|---|---|
| `footnote` | `\f`, `\fe`, `\ef`, `\efe` | Footnotes, endnotes, extended footnotes |
| `crossreference` | `\x`, `\ex` | Cross-references |

**Other categories:**

| Category | Markers | Description |
|---|---|---|
| `internal` | `\id`, `\c`, `\v`, `\tr`, `\ref`, `\fig`, `\esb`, `\esbe`, `\periph` | Structural markers, each with its own parse rule |
| `cell` | `\th1`–`\th12`, `\thc#`, `\thr#`, `\tc#`, `\tcc#`, `\tcr#` | Table cells (header / cell; left, centered, right) |
| `milestone` | `\qt-s`/`\qt-e`, `\qt1-s`…`\qt5-e`, `\ts-s`/`\ts-e`, `\ts`, `\t-s`/`\t-e`, `\wj-s`/`\wj-e` | Position marks that don't wrap content |
| `attribute` | `\ca`, `\cp`, `\va`, `\vp`, `\vid`, `\cat`, `\usfm` | Alternate/published numbers and metadata attached to a neighboring element |
| `identification` | none | Declared for completeness; `\id` is `internal` |

### Inline content

**Inline** content is what sits *inside* a paragraph, character span, note,
cell or header line, rather than starting a new block. Inline elements are
text, character spans, notes, `\ref`, `\fig`, milestones, verse markers,
inline attribute markers (`\ca`, `\vp`, …) and optional breaks (`//`).
`parseInlineContent` dispatches all of them. A marker that has no inline
handler (a `cell` marker inside a paragraph, for example) is reported as an
unknown marker.

```usfm
\p \v 1 In the beginning, \nd God\nd* created the heavens\f + \fr 1:1 \ft A note\f* and the earth.
```

Everything after `\p` is inline content of that paragraph.

### Verses are milestones

Following the USFM spec, `\v` is a **milestone**. It marks a position in the
text and does not contain the verse's text:

```usfm
\p \v 1 First verse text. \v 2 Second verse text.
```

This gives the paragraph four children: `verse 1`, `text`, `verse 2`, `text`.
To get "the text of verse 1", walk the paragraph and collect everything
between the `\v 1` and `\v 2` nodes. A verse can continue into the next
paragraph, so the walk has to cross paragraph boundaries.

Because verses don't contain anything, **character spans can cross verse
boundaries**:

```usfm
\v 17 Jesus said, \wj "I am the First and the Last,
\v 18 the Living One."\wj*
```

The `\wj` char node contains the verse 17 text, the `\v 18` verse node and
the verse 18 text.

### Default attributes

Some markers take attributes after a `|`: `key="value"` pairs, or a single
unkeyed value. An unkeyed value is assigned to the marker's **default
attribute** (`grammar.DefaultAttribute`):

```usfm
\w grace|grace\w*            →  attributes {lemma: "grace"}
\w grace|lemma="grace" strong="G5485"\w*
```

| Marker | Default attribute |
|---|---|
| `\w` | `lemma` |
| `\rb` | `gloss` |
| `\jmp`, `\xt` | `href` |
| `\ref` | `loc` |
| `\k` | `key` |
| `\tl`, `\wl` | `lang` |
| `\qt-s`, `\qt1-s`…`\qt5-s` | `who` |
| `\ts-s`, `\t-s` | `sid` |
| `\vid` | `ref` |
| `\fig` | `alt` |

The parser only applies this table to character spans (including note
chars) and `\ref`. Any other marker, or a character marker missing from the
table, stores an unkeyed value under `"default"`. That includes milestones
and figures; see [Known limitations](#known-limitations).

## Parsing USFM

Parsing has two phases: `lexer.Tokenize` turns the source into a flat token
stream, and `parser` builds the tree from those tokens with a
recursive-descent pass, one method per construct (`parseParagraph`,
`parseChar`, `parseNote`, …). Both phases track positions (see
[Positions and offsets](#positions-and-offsets)).

### Tokens

| `TokenType` | Source | `Value` |
|---|---|---|
| `marker` | `\p`, `\+nd` | marker name without `\` or `+`; `IsNested` is set for `+` |
| `end_marker` | `\nd*`, `\+nd*` | marker name; `IsEnd` is set |
| `text` | anything else | the text; adjacent text is merged into one token |
| `attribute` | `\|key="value" …` or `\|value` | `Attributes` map for key/value pairs; otherwise `Value` holds the unkeyed value |
| `optbreak` | `//` | `//` |
| `newline` | `\n`, `\r\n`, `\r` | `\n` |

Lexer details:

- Marker names are `[A-Za-z0-9_-]+`. A `\` followed by anything else
  (a space, or the end of input) is plain text.
- Escapes: `\\`, `\|` and `\~` produce the literal character as text (so
  `\~` gives `~`, not a no-break space). `\` at the end of a line is a
  newline token.
- An attribute runs from `|` to the next `\` or line break. `key="value"`
  pairs may be separated by spaces or tabs, and `\"` escapes a quote inside a
  value. If the text after `|` doesn't start with a `key=` pair, all of it
  becomes the unkeyed value. If it starts with pairs and something else
  follows, that remainder is lexed as ordinary text.
- The whitespace that separates a marker from its content is **not**
  consumed. It remains at the start of the following text token.

### Parse rules

At the top level (and inside books, chapters and sidebars),
`parseTopLevel` dispatches on the marker:

| Marker | Handler → node | Ends at |
|---|---|---|
| `\id` | `book`: the first word is `Code`, the rest of the line is `Description` | next `\id` |
| `\c` | `chapter`: the first word is `Number` | next `\c` or `\id` |
| paragraph-level (incl. `header`) | `paragraph` with inline children | next paragraph-level marker, `\c`, `\id`, `\tr`, `\esb`, `\esbe` |
| `\tr` | `row` of `cell`s | next `\tr`, paragraph-level marker, `\c`, `\id` |
| cell marker | `cell` | next cell, `\tr`, paragraph-level marker, `\c`, `\id`, or **end of line** |
| `\esb` | `sidebar` whose children are top-level content | `\esbe` (consumed). Nothing else ends it, not even `\c` or `\id` |
| `\fig` | `figure` | `\fig*`, or (unclosed) a paragraph-level marker, `\c`, `\id` |
| `\v`, character, note, milestone | same as inline (below) | |
| other `attribute`/`internal` (`\usfm`, `\cp`, `\vp`, `\periph`, stray `\esbe`/`\ref`) | `paragraph` for one line | end of line, paragraph-level marker, `\c`, `\id` |
| unknown | `unknown` leaf + `unknown-marker` error | |

Inside a paragraph, char span, note, cell, row or header line,
`parseInlineContent` handles:

| Content | Node | Ends at |
|---|---|---|
| `\v N` | `verse` leaf; the rest of the text token stays as a following `text` node | |
| character marker | `char`; `\|` attributes are applied to it | its own `\marker*`, or (unclosed) a paragraph-level marker, `\c`, `\id` |
| footnote / cross-reference char | `char` | its own end marker, the next note char, a note marker, a paragraph-level marker, or any other end marker (left for the enclosing note) |
| note marker | `note`: the first word of the first text is `Caller` (`+`, `-`, `a`, …) | its own `\f*` / `\x*`, or (unclosed) a paragraph-level marker, `\c`, `\id` |
| `\ref` | `ref`; `\|` attributes are applied (unkeyed value → `loc`) | `\ref*`, or (unclosed) a paragraph-level marker, `\c`, `\id` |
| `\fig` | `figure` (as above) | |
| milestone | `milestone` leaf; takes an attribute token *immediately* after the marker and an immediately following `\marker*` | |
| `attribute` marker (`\ca`, `\va`, `\vp`, …) | `char` with text children | its own end marker, any other marker, end of line |
| text | `text`; consecutive text tokens are merged | |
| newline | `text` node `" "` | |
| `//` | `optbreak` leaf | |
| end marker with no opener | none; `unexpected-end-marker` error | |
| attribute nobody consumed | none; `unattached-attribute` error | |
| any other marker | `unknown` leaf + `unknown-marker` error | |

Unclosed character spans, notes and `\ref`s are closed silently when a
structural boundary is reached. That is not reported as an error.

### Whitespace in the AST

Text nodes keep the source text almost verbatim, and consumers (the preview
builder, for example) normalize it:

- The separator after a marker is kept: `\nd Lord\nd*` gives a text child
  `" Lord"`.
- `\v`, `\c`, `\id` and note callers are split off with their separating
  whitespace: `\v 1 In the` gives `verse "1"` followed by `text "In the"`.
- Line breaks inside inline content become `" "` text nodes. At the top level
  (between paragraphs), a line break becomes a `text` node starting with
  `"\n"`.
- Whitespace splitting and trimming follow JavaScript rules (Unicode
  whitespace plus U+FEFF), via `internal/jsstr`.

### Errors

Parsing always yields a document. Problems are collected as `ParseError`s,
each with a message, a position and a stable `Code`:

| Code | Message | Raised when |
|---|---|---|
| `unknown-marker` | `Unknown marker '\zzz'` | the marker isn't in the grammar, or has no handler in this context |
| `unexpected-end-marker` | `Unexpected end marker '\nd*' with no matching opening marker` | an end marker doesn't close the innermost open element |
| `unattached-attribute` | `Attribute data not attached to any marker` | an attribute token appears where nothing consumes it |
| `chapter-text` | `Unexpected text after chapter number '\c 2'` | `\c` is followed by more than a number. The extra text is kept as chapter content |

`diagnostics` turns these into range-carrying editor diagnostics.

## The AST

`usfm.Node` is one struct for every node type. `Type` says which fields
apply. `Position` is where the node's opening marker (or the text) starts.
`Children` is non-nil (possibly empty) on container types and nil on leaves.

| `Type` | Created from | Fields | Children |
|---|---|---|---|
| `document` | root | | books, plus any content before the first `\id` |
| `book` | `\id` | `Marker: "id"`, `Code` (`"GEN"`), `Description` | everything up to the next `\id`: header paragraphs, chapters, … |
| `chapter` | `\c` | `Number` (source text, e.g. `"1"`) | paragraphs, rows, sidebars, … up to the next `\c`/`\id` |
| `verse` | `\v` | `Number` (source text, so ranges like `"1-2"` are kept) | leaf |
| `paragraph` | any paragraph-level marker, and top-level header/attribute/internal lines | `Marker` (`"p"`, `"q1"`, `"h"`, `"usfm"`, …) | inline content |
| `char` | character markers, note chars, inline attribute markers | `Marker`, `Attributes` (optional) | inline content |
| `note` | `\f`, `\fe`, `\x`, … | `Marker`, `Caller` | note chars and inline content |
| `ref` | `\ref` | `Attributes` (`loc`, …) | inline content |
| `row` | `\tr` | `Marker: "tr"` | `cell`s, plus any stray inline content |
| `cell` | `\th1`, `\tc1`, `\tcr2`, … | `Marker` | inline content |
| `table` | none | | Declared (inherited from the original TS type union) but never produced. Consecutive `row`s are siblings in the chapter |
| `milestone` | `\qt-s`, `\ts-e`, … | `Marker`, `Attributes` (optional) | leaf |
| `figure` | `\fig` | `Attributes`: `caption` (the first text run, trimmed) plus any `key="value"` pairs such as `src`, `size`, `ref` | leaf |
| `sidebar` | `\esb` … `\esbe` | `Marker: "esb"` | top-level content |
| `optbreak` | `//` | | leaf |
| `text` | text runs and line breaks | `Text` | leaf |
| `unknown` | unrecognized markers | `Marker` | leaf |

Some things the AST doesn't keep: the `+` of nested markers (a `\+nd` span is
a `char` node with `Marker: "nd"` nested in its parent), whether a span was
explicitly closed, and the end markers themselves.

For example,

```usfm
\id GEN Genesis
\c 1
\p \v 1 In the \nd Lord\nd*\f + \ft Note\f*
```

parses to this (positions omitted):

```
document
└─ book  code=GEN description="Genesis"
   └─ chapter  number=1
      └─ paragraph  marker=p
         ├─ text " "
         ├─ verse  number=1
         ├─ text "In the "
         ├─ char  marker=nd
         │  └─ text " Lord"
         ├─ note  marker=f caller=+
         │  └─ char  marker=ft
         │     └─ text " Note"
         └─ text " "            (the final line break)
```

`go run ./cmd/usfm parse file.usfm` prints the full tree as JSON.

## Known limitations

These are behaviors inherited from the original TS parser. The BSB corpus
uses none of these constructs.

- **Milestone self-closers.** The lexer doesn't recognize the `\*` that ends
  a milestone (`\qt-s |who="Pilate"\*`). The `\*` stays in the output as
  literal text.
- **Milestone attributes after a space.** Milestone attributes are only
  picked up when the `|` directly follows the marker (`\qt-s|who="Pilate"`).
  With the usual space before the `|`, the space becomes text and the
  attributes are reported as `unattached-attribute`.
- **Default attributes on milestones and figures.** An unkeyed milestone or
  `\fig` attribute is stored as `default`, not under `who`/`sid`/`alt` as the
  grammar specifies.
- **No `table` node.** Table rows aren't grouped into a table. Each `row`
  is a separate sibling, and `preview` renders each one as its own one-row
  table.
- **Top-level attribute markers.** Outside a paragraph (e.g. right after
  `\c`), markers such as `\vp 1a\vp*` or `\periph Title|id="title"` become
  one-line `paragraph` nodes. That reports `\vp*` as an unexpected end marker
  and the `\periph` attributes as unattached. Inside a paragraph the same
  `\vp 1a\vp*` is an inline `char` and parses cleanly. `\usfm 3.1` and
  `\cp 2` parse cleanly in either position.
- **Sidebars.** An unclosed `\esb` absorbs the rest of the file, including
  later chapters and books.
- **Figure captions.** Only the first text run inside `\fig` becomes
  `caption`. Markers inside a figure are skipped.

## Adding support for new markers

1. Add the marker to its category string in `grammar/grammar.go`, and to
   `defaultAttributes` if it has a default attribute. (A test checks that
   every marker with a default attribute has a category.)
2. If it needs its own parse rule, add a handler in `parser/parser.go` and
   dispatch to it from `parseTopLevel` and/or `parseInlineContent`.
3. Check how `preview` renders it and how the engine classifies it
   (syntax highlighting and completions come from the grammar).
4. Add tests.

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
  feature methods 1:1, plus two preview renderers: `RenderPreviewDocument`
  (renders the engine's synced copy — preferred when an editor is mounted,
  since the request ships only the id) and stateless `RenderPreviewText`
  (fallback for preview-only view mode, where no editor — and therefore no
  engine document — is mounted).
- Fresh analyses are pushed to the frontend as the `usfm:analysis` Wails
  event carrying `{id, version, diagnostics}`; the AST never crosses the
  bridge.
- On the frontend, `createWailsLanguageClient()`
  (`apps/bible-edit/frontend/src/language-client.ts`) implements the
  `UsfmLanguageClient` protocol from `@usfm-tools/controls`. Editor views
  showing the same file share one engine document (document sessions keyed
  by file id; sibling views converge synchronously), synced through
  `DocumentSync` (ordered queue, monotonic versions, self-healing reopen if
  an update is rejected).

Components fall back to an inert stub client (`createStubLanguageClient`:
no diagnostics or highlighting, escaped-source preview) when no engine is
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

Two layers:

1. **Unit tests** per package, originally ported from the TS test suites
   (grammar, lexer, parser, diagnostics, preview, engine, CLI) plus Go-side
   additions (UTF-16 edge cases, concurrency/staleness, `-race`).
2. **Corpus tests** (`integration/`): all 66 books of the Berean Standard
   Bible (`bibles/bsb/usfm`) parse with zero errors; the full Bible parses
   in ~0.25 s. `BenchmarkParsePsalms` tracks single-book latency on the
   largest book.

## Fidelity notes

The port reproduced the TS parser's behavior exactly, including its error
recovery (verified byte-for-byte across the corpus before the TS parser was
removed). Recovery rules worth knowing:

- Text after a chapter number (`\c 1 extra`) is reported
  (`chapter-text`) and kept as chapter content, not dropped.
- `\fig` parses as a figure both at the top level and inline (USFM 3 puts
  it inside paragraphs); an unclosed `\fig` ends at the next paragraph,
  `\c` or `\id` marker.
- A note's caller is its first word; the rest of that text run is kept
  verbatim (whitespace included), as with text after a verse number.

Diagnostic *codes* (`unknown-marker`, `unexpected-end-marker`,
`unattached-attribute`, `chapter-text`) and byte offsets are Go-side
additions the TS parser never had.
