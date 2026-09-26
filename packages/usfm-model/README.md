# @usfm-tools/model

Application-level helpers for [USFM](https://docs.usfm.bible/usfm/3.1.1/index.html) scripture data that don't need a parser: standard book identifier metadata, file-picker grouping, and lightweight text scans (book code, picker header, chapter markers).

## Purpose

Parsing, diagnostics, syntax classification and preview rendering live in the Go engine ([`usfm-parser-go`](../../usfm-parser-go/README.md)), reached from the UI through the `UsfmLanguageClient` protocol in `@usfm-tools/controls`. This package holds the small, synchronous pieces the UI needs without a round trip to the engine — for example grouping a folder's files in a sidebar, or tracking chapter markers while typing.

## Installation

Add `@usfm-tools/model` as a dependency in your Deno workspace or import map.

## Usage

### Standard book identifiers and file picker model

The USFM specification defines a fixed set of [book identifiers](https://ubsicap.github.io/usfm/identification/books.html) (the three-character code after `\\id`). This package exposes that table as **`STANDARD_USFM_BOOK_IDENTIFIERS`** (in official table order, with each row’s **Number** field and a canon grouping: Old Testament, New Testament, or other).

Helpers such as **`isStandardUsfmBookIdentifier`**, **`normalizeUsfmBookCode`**, and **`getStandardUsfmBookIdentifier`** support validation and metadata lookup.

**`buildUsfmFilePickerGroups(files)`** groups `{ id, name, usfm }` entries (for folder sidebars) into **`oldTestament`**, **`newTestament`**, and **`other`** (standard codes outside OT/NT), each sorted by the official table order and then file name, plus **`nonStandard`**: files whose first `\\id` code is not in the standard list, files with an empty `\\id` line, and non-empty files with no `\\id` at all. Labels are the file names, so it only needs each file's `\\id` code, read by **`scanUsfmBookCode(usfm)`** — a lightweight scan that follows the lexer's rules for escapes, nested/end markers and attribute values (it only disagrees with the parser when an unclosed top-level `\\esb` precedes the `\\id`). **`UsfmFilePicker`** in **`@usfm-tools/controls`** and **`UsfmShell`**’s file browser consume it.

```typescript
import { buildUsfmFilePickerGroups } from "@usfm-tools/model";

const { oldTestament, newTestament, other, nonStandard } = buildUsfmFilePickerGroups([
  { id: "f1", name: "01-GEN.usfm", usfm: "\\id GEN\n\\c 1\n..." },
  { id: "f2", name: "hymns.usfm", usfm: "\\id HYM\n..." }, // not a standard code → nonStandard
]);
```

### Chapter markers with source offsets (`listChapterMarkersInUsfm`, `chapterNumberAtOrBeforeSourceOffset`)

**`listChapterMarkersInUsfm(usfm)`** scans raw USFM for the first book's `\\c` markers and returns `{ number, markerOffset }[]` in **document order** (the offset is the UTF-16 start of the `\\c` marker). Numbers are verbatim — no sorting, deduplication, or numeric parsing — so non–Western Arabic numerals, gaps, or duplicates are preserved. It is fast enough to refresh on debounced editor updates in **`UsfmPane`**; pass the numbers to **`ChapterPicker`** as **`chapterNumbers`**. **`bookIdMarkerOffsetInUsfm(usfm)`** locates the first `\\id` marker the same way.

**`chapterNumberAtOrBeforeSourceOffset(markers, sourceOffset)`** returns the chapter **number** for the last marker whose offset is still at or before **`sourceOffset`**, or **`null`** when the offset lies before the first chapter marker or the book has no chapters.

```typescript
import {
  listChapterMarkersInUsfm,
  chapterNumberAtOrBeforeSourceOffset,
} from "@usfm-tools/model";

const markers = listChapterMarkersInUsfm("\\id GEN\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
chapterNumberAtOrBeforeSourceOffset(markers, markers[1]!.markerOffset); // "2"
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
│   ├── index.ts                         # Public API
│   ├── book-identifiers/                # Standard \\id codes, book-code/header scans, file picker groups
│   └── list-chapter-markers-in-usfm.ts  # Lightweight \\c / \\id scans on raw USFM
├── tests/
└── deno.json
```

## License

MIT
