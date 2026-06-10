# @usfm-tools/model

Application-level model for [USFM](https://docs.usfm.bible/usfm/3.1.1/index.html) scripture data, built on top of [`@usfm-tools/parser`](../usfm-parser/).

## Purpose

The parser produces a low-level AST that faithfully represents the USFM markup structure. This package provides higher-level abstractions closer to what applications need — including **view models** for UI-friendly projections and **HTML rendering** for publication-style reading views.

## Installation

Add `@usfm-tools/model` as a dependency in your Deno workspace or import map.

## Usage

### Parse (re-exported from the parser)

```typescript
import { parse } from "@usfm-tools/model";

const result = parse(`\\id GEN
\\c 1
\\p
\\v 1 In the beginning God created the heavens and the earth.`);
```

### View models

View models reshape the AST for specific UI tasks. They live under the **`ViewModels`** object so additional families can be added later without colliding.

- **`ViewModels.Publication`** — alias of **`PublicationViewModel`**: publication / “Bible app” reading layout (`buildPreview`, `applyVersePerLine`, and types such as `PreviewDocument`).

```typescript
import { ViewModels, parse } from "@usfm-tools/model";

const { document } = parse(usfmText);
const preview = ViewModels.Publication.buildPreview(document, { versePerLine: true });
```

### Standard book identifiers and book picker model

The USFM specification defines a fixed set of [book identifiers](https://ubsicap.github.io/usfm/identification/books.html) (the three-character code after `\\id`). This package exposes that table as **`STANDARD_USFM_BOOK_IDENTIFIERS`** (in official table order, with each row’s **Number** field and a canon grouping: Old Testament, New Testament, or other).

Helpers such as **`isStandardUsfmBookIdentifier`**, **`normalizeUsfmBookCode`**, and **`getStandardUsfmBookIdentifier`** support validation and metadata lookup.

For UI that lists available books from in-memory USFM files, **`buildUsfmBookPickerGroups(files)`** parses each file’s USFM (via the bundled parser), reads `\\toc1` / `\\toc2` / `\\toc3`, and returns four collections: **`oldTestament`**, **`newTestament`**, and **`other`** (standard codes outside OT/NT), each sorted by the official table order, plus **`nonStandard`**. The latter includes files whose first `\\id` code is not in the standard list, files with a **missing or empty** `\\id` line on the first book, and files **with no `\\id` at all** (non-empty USFM): for those, TOC markers are read from **top-level** paragraphs on the document, and **`code`** is an empty string when there is no id token. Order within **`nonStandard`** follows the input **`files`** array. Old/New Testament titles prefer `\\toc3` with code fallback; other standard books and non-standard rows use `\\toc1`, then `\\toc2`, then `\\toc3`, then the `\\id` code, then the file **`id`** when no code and no toc text. The **`UsfmBookPicker`** React control in **`@usfm-tools/controls`** consumes this function.

```typescript
import { buildUsfmBookPickerGroups } from "@usfm-tools/model";

const { oldTestament, newTestament, other, nonStandard } = buildUsfmBookPickerGroups([
  { id: "file-gen", usfm: "\\id GEN\n\\toc3 Gen\n..." },
  { id: "file-hym", usfm: "\\id HYM\n\\toc1 Hymnal\n..." },
  { id: "file-extra", usfm: "\\toc1 Music supplement\n\\c 1\n\\p\n" }, // no \\id → nonStandard, code ""
]);
```

### Chapter numbers on a book (`listChapterNumbersFromBook`)

**`listChapterNumbersFromBook(book)`** walks a parsed **`BookNode`** and returns every **`\\c`** chapter number string in **document order**. Values are taken verbatim from the AST (no sorting, deduplication, or numeric parsing), so non–Western Arabic numerals, gaps, or duplicate markers are preserved exactly as encoded. The **`ChapterPicker`** control in **`@usfm-tools/controls`** uses this helper.

```typescript
import { parse, listChapterNumbersFromBook } from "@usfm-tools/model";

const { document } = parse("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
const book = document.children.find((n) => n.type === "book")!;
const chapters = listChapterNumbersFromBook(book); // ["10", "2"]
```

### Chapter markers with source offsets (`listChapterMarkersInBook`, `chapterNumberAtOrBeforeSourceOffset`)

**`listChapterMarkersInBook(book)`** returns `{ number, markerOffset }[]` for each chapter child on a **`BookNode`** that has a parser **`position`** (the offset is the start of the `\\c` marker in the USFM source). **`chapterNumberAtOrBeforeSourceOffset(markers, sourceOffset)`** returns the chapter **number** for the last marker whose offset is still at or before **`sourceOffset`**, or **`null`** when the offset lies before the first chapter marker or the book has no chapters. Together these support full-file tools such as **`UsfmPane`** and **`UsfmWorkspace`** in **`@usfm-tools/controls`**.

```typescript
import { parse, listChapterMarkersInBook, chapterNumberAtOrBeforeSourceOffset } from "@usfm-tools/model";

const { document } = parse("\\id GEN\\n\\c 1\\n\\p\\n\\v 1\\n\\c 2\\n\\p\\n\\v 1");
const book = document.children.find((n) => n.type === "book")!;
const markers = listChapterMarkersInBook(book as import("@usfm-tools/parser").BookNode);
chapterNumberAtOrBeforeSourceOffset(markers, markers[1]!.markerOffset); // "2"
```

### HTML rendering (`renderPreviewHtml`)

**`renderPreviewHtml(usfm, options?)`** turns a USFM source string into publication-style HTML with a fixed, hardcoded markup. Parser errors (if any) are surfaced as an `<aside class="usfm-preview-errors">` banner at the top of the output. The optional **`RenderPreviewOptions`** currently supports `{ versePerLine: true }` to expand multi-verse paragraphs into one `<p>` per verse. Customize presentation by styling the emitted CSS class hooks (`usfm-document`, `usfm-book`, `usfm-chapter`, `usfm-line`, `usfm-line--prose`, `usfm-line--poetry`, `usfm-v`, `usfm-txt`, `usfm-nd`, `usfm-note`, `usfm-ref`, …) in your app's stylesheet.

```typescript
import { renderPreviewHtml } from "@usfm-tools/model";

const html = renderPreviewHtml(src, { versePerLine: true });
```

## Development

### Prerequisites

- Deno 2+

### Setup

```bash
cd packages/usfm-model
```

### Tasks

| Command            | Description                |
|--------------------|----------------------------|
| `deno task check`  | Type-check `src/`          |
| `deno task test`   | Run tests                  |
| `deno task lint`   | Lint sources and tests     |

### Project Structure

```
packages/usfm-model/
├── src/
│   ├── index.ts                    # Public API
│   ├── book-identifiers/           # Standard \\id codes + buildUsfmBookPickerGroups
│   ├── view-models/
│   │   └── publication-preview.ts  # PublicationViewModel + ViewModels.Publication alias
│   └── renderer/
│       ├── render-preview-html.ts  # renderPreviewHtml(usfm, options?)
│       └── index.ts
├── tests/
│   ├── model.test.ts
│   ├── book-picker-model.test.ts
│   ├── publication-preview.test.ts
│   └── render-preview-html.test.ts
└── deno.json
```

## Architecture

```
USFM text → @usfm-tools/parser (AST) → view models (e.g. PublicationViewModel) → renderPreviewHtml → HTML
```

The publication view model flattens the AST into blocks (headings, poetry/prose lines, tables, etc.) and inline **segments** (verse milestones, text, character styles, notes). **`renderPreviewHtml`** walks that structure and emits HTML with a fixed set of `usfm-*` CSS class hooks — customize presentation through CSS rather than markup overrides.

## License

MIT
