# @usfm-tools/parser-integration-tests

Integration tests for the `@usfm-tools/parser` package, validating it against the full [Berean Standard Bible](https://bereanbible.com) (66 books, USFM 3.1 format).

## What This Tests

### 1. Parse Without Exceptions

All 66 BSB books are parsed in non-strict mode. The test verifies that no exceptions are thrown for any book, regardless of parse errors collected in the result.

### 2. Performance

The entire BSB Bible (66 books, ~48K lines of USFM) must parse in **under 30 seconds**. In practice it completes in under 500ms.

### 3. Sampled Output Verification

Rather than validating every node in every book, the test samples specific books and checks expected structural properties:

| Book | Assertions |
|------|------------|
| **Genesis** | Book code `GEN`, 50 chapters, verse 1:1 contains "In the beginning God created", section heading "The Creation" |
| **Psalms** | Book code `PSA`, 150 chapters, poetry markers (`q1`/`q2`), Psalm 1:1 "Blessed is the man" |
| **Matthew** | Book code `MAT`, 28 chapters, header "Matthew", footnotes in chapter 1 with caller `+` |
| **Revelation** | Book code `REV`, 22 chapters, `\wj` (words of Jesus) char nodes present |

### 4. Error Characterization

All parse errors across the full BSB are collected. The test verifies that the entire BSB parses with **zero errors**.

Previous parser limitations that have been resolved:

- **`\ref` inline** — `\ref...\ref*` is used inline in `\r` headings and footnotes. The parser now handles `\ref` in inline context, producing `ref` AST nodes with `loc` attributes.
- **Cross-verse character spans** — `\wj...\wj*` spans across verse boundaries. Since `\v` is modeled as a milestone (not a container), char markers span freely across verse boundaries.

## Running

```bash
cd packages/usfm-parser-integration-tests
npm install
npm test
```

**Prerequisites:** The parser package must be built first (`npm run build` in `packages/usfm-parser`).

## Test Data

The USFM files are at `bibles/bsb/usfm/` (66 books, BSB v5.2, public domain). See `bibles/bsb/ATTRIBUTION.md` for source and license details.
