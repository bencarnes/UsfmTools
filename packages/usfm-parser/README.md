# @usfm-tools/parser

A TypeScript parser for [USFM](https://docs.usfm.bible/usfm/3.1.1/index.html) (Unified Standard Format Markers) — the standard markup format for encoding Bible/scripture text.

This parser tokenizes and parses USFM source text into a structured AST (Abstract Syntax Tree) that can be traversed, transformed, or serialized by downstream tools.

## Features

- Full USFM 3.x marker support (paragraphs, characters, footnotes, cross-references, tables, milestones, figures, sidebars)
- TypeScript source exports via `deno.json` (Deno workspace member; no separate npm `dist/` bundle)
- Detailed position tracking for all AST nodes
- Graceful error recovery (non-strict mode) or fail-fast (strict mode)
- Zero runtime dependencies

## Installation

Add `@usfm-tools/parser` as a dependency in your Deno workspace or import map.

## Usage

### Basic Parsing

```typescript
import { parse } from "@usfm-tools/parser";

const usfm = `\\id GEN English Standard Version
\\h Genesis
\\mt1 Genesis
\\c 1
\\s1 The Creation of the World
\\p
\\v 1 In the beginning, God created the heavens and the earth.
\\v 2 The earth was without form and void.`;

const result = parse(usfm);

console.log(result.document.type); // "document"
console.log(result.errors);        // [] (empty if no errors)

// Access the book node
const book = result.document.children[0];
// book.type === "book"
// book.code === "GEN"
```

### Attributes

Character markers like `\w` support USFM attributes via the `|` syntax. Both key-value and positional (default) attributes are captured on the AST node:

```typescript
import { parse } from "@usfm-tools/parser";

// Key-value attributes
const r1 = parse('\\id GEN\n\\c 1\n\\p\n\\v 1 \\w grace|lemma="grace" strong="G5485"\\w*');
const w1 = /* navigate to the \w CharNode */;
// w1.attributes === { lemma: "grace", strong: "G5485" }

// Positional (default) attribute — mapped via DEFAULT_ATTRIBUTES
const r2 = parse('\\id GEN\n\\c 1\n\\p\n\\v 1 \\w grace|grace\\w*');
const w2 = /* navigate to the \w CharNode */;
// w2.attributes === { lemma: "grace" }  (because \w's default attribute is "lemma")
```

The default attribute name is determined by the marker. For example, `\w` maps to `lemma`, `\rb` maps to `gloss`, `\jmp` maps to `href`. If a marker has no defined default, the key `"default"` is used.

### Strict Mode

By default the parser collects errors and continues parsing. In strict mode, it throws on the first error:

```typescript
import { parse } from "@usfm-tools/parser";

try {
  const result = parse("\\id GEN\n\\v 1 \\zzz bad marker", { strict: true });
} catch (err) {
  console.error(err.message);
}
```

### Using the Lexer Directly

For advanced use cases, the lexer can be used independently to tokenize USFM:

```typescript
import { Lexer } from "@usfm-tools/parser";

const lexer = new Lexer("\\v 1 In the beginning");
const tokens = lexer.tokenize();

for (const token of tokens) {
  console.log(token.type, token.value, token.position);
}
```

### Grammar Utilities

Helper functions are exported for working with USFM markers:

```typescript
import {
  getMarkerCategory,
  isParaMarker,
  isCharMarker,
  isNoteMarker,
} from "@usfm-tools/parser";

getMarkerCategory("p");   // "versepara"
isParaMarker("q1");        // true
isCharMarker("nd");        // true
isNoteMarker("f");         // true
```

## AST Structure

The parser produces a tree of typed nodes. Key node types:

| Node Type     | Description                                  | Key Fields                  |
|---------------|----------------------------------------------|-----------------------------|
| `document`    | Root node                                    | `children`                  |
| `book`        | Book identification (`\id`)                  | `code`, `children`          |
| `chapter`     | Chapter (`\c`)                               | `number`, `children`        |
| `verse`       | Verse milestone (`\v`)                       | `number`                    |
| `paragraph`   | Paragraph-level element (`\p`, `\q1`, etc.)  | `marker`, `children`        |
| `char`        | Character style (`\nd`, `\wj`, etc.)         | `marker`, `children`, `attributes?` |
| `note`        | Footnote or cross-reference (`\f`, `\x`)     | `marker`, `caller`, `children` |
| `table`       | Table container                              | `children`                  |
| `row`         | Table row (`\tr`)                            | `children`                  |
| `cell`        | Table cell (`\th1`, `\tc1`, etc.)            | `marker`, `children`        |
| `milestone`   | Milestone marker (`\qt-s`, `\ts-s`, etc.)    | `marker`, `attributes`      |
| `text`        | Plain text content                           | `text`                      |
| `optbreak`    | Optional line break (`//`)                   | —                           |

## Grammar Terminology

USFM organizes content using **markers** — backslash-prefixed tags like `\p`, `\v`, and `\nd`. The parser classifies every marker into a **category** that determines where it can appear and how it interacts with surrounding content. This section defines the key terms and concepts.

### Marker

A marker is a backslash-prefixed tag that introduces a USFM element. Markers come in three forms:

| Form | Example | Meaning |
|------|---------|---------|
| Opening marker | `\nd` | Starts an element |
| Closing (end) marker | `\nd*` | Ends a paired element |
| Nested marker | `\+nd` | Starts a nested element inside another element of the same level |

```usfm
\p \v 1 The \nd Lord\nd* spoke to Moses.
```

Here `\p` is a paragraph marker, `\v` is a verse marker, and `\nd...\nd*` is a paired character marker wrapping "Lord".

### Category

Every marker belongs to a **category** that determines its structural role. Categories are defined in `grammar.ts` and fall into several groups:

**Paragraph-level categories** — markers that create block-level structure. A new paragraph-level marker implicitly closes the previous one:

| Category | Examples | Description |
|----------|----------|-------------|
| `header` | `\h`, `\toc1`, `\toc2` | Book header metadata |
| `title` | `\mt1`, `\mt2` | Main title of the book |
| `introduction` | `\ip`, `\imt1`, `\io1` | Introductory material |
| `sectionpara` | `\s1`, `\s2`, `\r`, `\mr` | Section headings and references |
| `versepara` | `\p`, `\q1`, `\q2`, `\m`, `\pmo` | Prose and poetry paragraphs containing verse text |
| `list` | `\li1`, `\li2`, `\lh` | List entries |
| `otherpara` | `\rem`, `\lit`, `\pb` | Miscellaneous paragraph types |

```usfm
\s1 The Creation
\p \v 1 In the beginning God created the heavens and the earth.
\q1 \v 2 The earth was formless and void,
\q2 and darkness was over the deep.
```

`\s1` (sectionpara) is implicitly closed when `\p` (versepara) begins. `\p` is implicitly closed when `\q1` begins.

**Character-level categories** — markers for inline text styling and annotation. These appear *inside* paragraph content and are always explicitly closed with `\marker*`:

| Category | Examples | Description |
|----------|----------|-------------|
| `char` | `\nd`, `\wj`, `\bk`, `\w`, `\it`, `\bd` | General character styles |
| `footnotechar` | `\fr`, `\ft`, `\fq`, `\fqa` | Character styles within footnotes |
| `crossreferencechar` | `\xo`, `\xt`, `\xq` | Character styles within cross-references |
| `introchar` | `\ior`, `\iqt` | Character styles within introductions |
| `listchar` | `\lik`, `\litl`, `\liv1` | Character styles within lists |

```usfm
\v 1 The \nd Lord\nd* said, \wj "Follow me."\wj*
```

`\nd` and `\wj` are character-level markers. They wrap inline spans of text and must be closed by `\nd*` and `\wj*`.

**Note categories** — markers that introduce footnotes or cross-references. Notes contain their own character-level content:

| Category | Examples | Description |
|----------|----------|-------------|
| `footnote` | `\f`, `\fe`, `\ef` | Footnotes and endnotes |
| `crossreference` | `\x`, `\ex` | Cross-reference notes |

```usfm
\v 1 In the beginning\f + \fr 1:1 \ft Or "At the start"\f* God created...
```

`\f...\f*` wraps the entire footnote. Inside it, `\fr` and `\ft` are footnotechar markers that structure the note's content. Footnotechar markers are **implicitly closed** by the next footnotechar or by the parent note's end marker — they don't require `\fr*` or `\ft*`.

**Other categories:**

| Category | Examples | Description |
|----------|----------|-------------|
| `internal` | `\id`, `\c`, `\v`, `\tr`, `\ref`, `\fig` | Structural markers with special parsing rules |
| `cell` | `\th1`, `\tc1`, `\tcr1` | Table cell markers |
| `milestone` | `\qt-s`, `\qt-e`, `\ts-s` | Standalone position markers (not paired like char) |
| `attribute` | `\ca`, `\va`, `\vp`, `\usfm` | Markers that set attributes on their parent |

### Inline

**Inline** refers to content that appears *within* a paragraph, verse, footnote, or other container — as opposed to content that starts a new structural block. The parser processes inline content through `parseInlineContent()`.

Inline elements include:

- **Text** — plain text between markers
- **Character-level markers** — `\nd...\nd*`, `\wj...\wj*`, `\w...\w*`, etc.
- **Notes** — `\f...\f*`, `\x...\x*`
- **Milestones** — `\qt-s`, `\qt-e`
- **Verses** — `\v` (when inside a paragraph)
- **Optional breaks** — `//`

```usfm
\p \v 1 In the beginning, \nd God\nd* created the heavens\f + \fr 1:1 \ft A note\f* and the earth.
```

Everything after `\p` is inline content: the verse marker, text, the `\nd` character span, the footnote, and more text.

A marker that is valid at the top level (like `\ref` in the `internal` category) may or may not be recognized in inline context. When the parser encounters a marker inline that it doesn't have an inline handler for, it reports an "Unknown marker" error. This is a parser limitation, not necessarily an invalid USFM file.

### Paragraph-Level Marker

A **paragraph-level marker** creates a block-level element in the document. Paragraph-level markers have **implicit closure** — when a new paragraph-level marker appears, the previous paragraph is automatically closed without needing an explicit end marker.

```usfm
\s1 The Beginning
\p \v 1 First paragraph text.
\p \v 2 Second paragraph text.
\q1 \v 3 Poetry line one.
\q2 Poetry line two.
```

Each of `\s1`, `\p`, `\q1`, and `\q2` implicitly closes the previous paragraph. The parser groups them under `PARA_CATEGORIES`: header, title, introduction, sectionpara, versepara, list, and otherpara.

### Character-Level Marker

A **character-level marker** creates an inline text span inside a paragraph or other container. Unlike paragraph markers, character-level markers are **explicitly closed** with an end marker (`\marker*`).

```usfm
\v 1 The \bk Book of Genesis\bk* begins with creation.
\v 2 \w grace|lemma="grace"\w* was given freely.
```

`\bk...\bk*` wraps "Book of Genesis" as a book name. `\w...\w*` wraps "grace" as a word with linguistic attributes.

Character-level markers can **nest** using the `+` prefix:

```usfm
\v 1 \wj The words of \+nd Jesus\+nd* the Lord.\wj*
```

`\+nd...\+nd*` is nested inside `\wj...\wj*`, producing a child char node inside the parent char node.

The parser groups character-level markers under `CHAR_CATEGORIES`: char, introchar, listchar, footnotechar, and crossreferencechar.

### Verse-Level Boundary

A **verse-level boundary** is the point where one verse ends and the next begins, marked by `\v`. Following the USFM spec, this parser models `\v` as a **milestone** — a positional marker in the stream, not a container that wraps content.

```usfm
\p \v 1 First verse text. \v 2 Second verse text.
```

In the AST, `\v 1` and `\v 2` are sibling milestone nodes within the paragraph. The text "First verse text." appears as a sibling text node between the two verse milestones. To extract "all text in verse 1", walk the paragraph's children and collect nodes between the `\v 1` and `\v 2` milestones.

Because verses are milestones (not containers), **character-level markers can span freely across verse boundaries**:

```usfm
\v 17 Jesus said, \wj "I am the First and the Last,
\v 18 the Living One."\wj*
```

The `\wj` char node contains both the text from verse 17, the `\v 18` milestone, and the text from verse 18 — all as children. The `\wj*` end marker is correctly matched regardless of how many verse milestones appear inside the span.

### Internal-Category Marker

An **internal-category marker** is a structural marker that has unique, context-specific parsing rules rather than following the standard paragraph or character patterns. Internal markers are defined in the `internal` category in `grammar.ts`.

| Marker | Role |
|--------|------|
| `\id` | Book identification — must be the first marker in a file |
| `\c` | Chapter number |
| `\v` | Verse number |
| `\tr` | Table row |
| `\ref` | Cross-reference link |
| `\fig` | Figure/illustration |
| `\esb` / `\esbe` | Sidebar start/end |
| `\periph` | Peripheral content division |

Each has a dedicated parsing method. For example, `\c` extracts a chapter number from the following text, while `\tr` opens a table row and expects cell markers.

```usfm
\id GEN English Standard Version
\c 1
\tr \th1 Name \th2 Age
\tr \tc1 Adam \tc2 930
```

Because internal markers have specialized handlers, they are only recognized in the contexts where those handlers are wired up. A marker like `\ref` is handled at the top level but not yet in inline context, which is why `\ref` used inline (as in `\r (\ref John 1:1|JHN 1:1\ref*)`) produces parse errors.

### Milestone

A **milestone** is a standalone marker that marks a position in the text without wrapping content. Milestones come in start/end pairs using the `-s` and `-e` suffixes, or as standalone markers.

```usfm
\qt-s |who="God"\*In the beginning God created the heavens and the earth.\qt-e\*
```

`\qt-s` marks the start of a quotation by "God" and `\qt-e` marks the end. Unlike character markers, milestones are self-closing (each has its own `\*`) and don't need to nest within verse or paragraph boundaries — they can span freely across structural elements.

### Default Attribute

When a marker supports attributes via the `|` pipe syntax, it may define a **default attribute** — the attribute name that receives an unkeyed positional value.

```usfm
\w grace|grace\w*
```

This is equivalent to `\w grace|lemma="grace"\w*` because `\w`'s default attribute is `lemma`. The mapping is defined in `DEFAULT_ATTRIBUTES` in `grammar.ts`. Examples:

| Marker | Default attribute | Example |
|--------|------------------|---------|
| `\w` | `lemma` | `\w grace\|grace\w*` → `lemma: "grace"` |
| `\rb` | `gloss` | `\rb 漢字\|ルビ\rb*` → `gloss: "ルビ"` |
| `\jmp` | `href` | `\jmp link\|#target\jmp*` → `href: "#target"` |
| `\ref` | `loc` | `\ref Gen 1:1\|GEN 1:1\ref*` → `loc: "GEN 1:1"` |

### Implicit Closure

**Implicit closure** is when an element is automatically closed by the appearance of another element, without an explicit end marker. This applies to paragraph-level markers and footnote/crossref char markers.

Paragraph example:
```usfm
\s1 Heading
\p \v 1 Paragraph text.
```
`\s1` is implicitly closed when `\p` appears — there is no `\s1*`.

Footnote char example:
```usfm
\f + \fr 1:1 \ft A footnote.\f*
```
`\fr` is implicitly closed when `\ft` appears — there is no `\fr*`. Both are implicitly closed when `\f*` ends the footnote.

## Development

### Prerequisites

- Deno 2+

### Setup

```bash
cd packages/usfm-parser
```

### Tasks

| Command            | Description                |
|--------------------|----------------------------|
| `deno task check`  | Type-check `src/`          |
| `deno task test`   | Run tests                  |
| `deno task lint`   | Lint sources and tests     |

### Project Structure

```
packages/usfm-parser/
├── src/
│   ├── index.ts        # Public API and convenience parse() function
│   ├── lexer.ts        # Tokenizer — converts USFM text to tokens
│   ├── parser.ts       # Parser — builds AST from token stream
│   ├── grammar.ts      # Marker categories and classification helpers
│   └── types.ts        # TypeScript interfaces for tokens and AST nodes
├── tests/
│   ├── lexer.test.ts   # Lexer unit tests
│   ├── parser.test.ts  # Parser integration tests
│   └── grammar.test.ts # Grammar helper tests
└── deno.json           # Deno package manifest and tasks
```

### Architecture

The parser uses a two-phase approach:

1. **Lexer** — Scans the source text and produces a flat stream of tokens (markers, text, attributes, newlines, optional breaks).
2. **Parser** — Consumes the token stream and builds a hierarchical AST according to USFM grammar rules. It handles implicit paragraph closure, nested character styles, footnote/cross-reference structure, and table layout.

### Adding Support for New Markers

1. Add the marker to the appropriate category string in `src/grammar.ts`.
2. If the marker has special parsing behavior, add a handler method in `src/parser.ts`.
3. Add tests covering the new marker in `tests/`.

## References

- [USFM Documentation (3.1.1)](https://docs.usfm.bible/usfm/3.1.1/index.html)
- [USFM Grammar Definition](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usfm.ext)
- [Reference Python Implementation](https://github.com/usfm-bible/usfmtc)

## License

MIT
