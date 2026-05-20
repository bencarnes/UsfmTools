import { describe, it, expect } from "vitest";
import {
  buildUsfmBookPickerGroups,
  isStandardUsfmBookIdentifier,
  normalizeUsfmBookCode,
} from "../src/book-identifiers/index.js";

describe("standard book identifiers", () => {
  it("normalizes book codes", () => {
    expect(normalizeUsfmBookCode("  gen ")).toBe("GEN");
    expect(normalizeUsfmBookCode("1sa extra")).toBe("1SA");
  });

  it("recognizes standard codes", () => {
    expect(isStandardUsfmBookIdentifier("GEN")).toBe(true);
    expect(isStandardUsfmBookIdentifier("XYZ")).toBe(false);
  });
});

describe("buildUsfmBookPickerGroups", () => {
  it("orders Old and New Testament by standard table number, not input order", () => {
    const groups = buildUsfmBookPickerGroups([
      { id: "b", usfm: "\\id MAT\n\\toc3 Mat\n\\c 1\n\\p\n" },
      { id: "a", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament.map((b) => b.code)).toEqual(["GEN"]);
    expect(groups.newTestament.map((b) => b.code)).toEqual(["MAT"]);
    expect(groups.oldTestament[0]?.fileId).toBe("a");
    expect(groups.newTestament[0]?.fileId).toBe("b");
    expect(groups.nonStandard).toHaveLength(0);
  });

  it("places non-standard \\id files in nonStandard in input order", () => {
    const groups = buildUsfmBookPickerGroups([
      { id: "x", usfm: "\\id ZZZ\n\\toc1 Custom A\n\\c 1\n\\p\n" },
      { id: "y", usfm: "\\no id here\n" },
      { id: "z", usfm: "\\id ABC\n\\toc1 Custom B\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament).toHaveLength(0);
    expect(groups.newTestament).toHaveLength(0);
    expect(groups.other).toHaveLength(0);
    expect(groups.nonStandard.map((b) => b.code)).toEqual(["ZZZ", "", "ABC"]);
    expect(groups.nonStandard.map((b) => b.displayLabel)).toEqual(["Custom A", "y", "Custom B"]);
  });

  it("includes files with no \\id as non-standard using top-level \\toc and file id fallback", () => {
    const groups = buildUsfmBookPickerGroups([
      {
        id: "hymn-file",
        usfm: `\\toc1 Standalone hymnal
\\c 1
\\p
`,
      },
    ]);
    expect(groups.nonStandard).toHaveLength(1);
    expect(groups.nonStandard[0]?.code).toBe("");
    expect(groups.nonStandard[0]?.displayLabel).toBe("Standalone hymnal");
  });

  it("uses empty \\id code with book-level toc for non-standard", () => {
    const groups = buildUsfmBookPickerGroups([
      {
        id: "blank-id",
        usfm: `\\id
\\toc1 From toc only
\\c 1
\\p
`,
      },
    ]);
    expect(groups.nonStandard[0]?.code).toBe("");
    expect(groups.nonStandard[0]?.displayLabel).toBe("From toc only");
  });

  it("omits whitespace-only files", () => {
    const groups = buildUsfmBookPickerGroups([{ id: "empty", usfm: "  \n\t  " }]);
    expect(groups.nonStandard).toHaveLength(0);
    expect(groups.oldTestament).toHaveLength(0);
  });

  it("uses \\toc1 then \\toc2 then \\toc3 for non-standard labels", () => {
    const t2 = buildUsfmBookPickerGroups([
      { id: "1", usfm: "\\id HYM\n\\toc2 Short title\n\\toc3 Hy\n\\c 1\n\\p\n" },
    ]);
    expect(t2.nonStandard[0]?.displayLabel).toBe("Short title");

    const t3 = buildUsfmBookPickerGroups([
      { id: "1", usfm: "\\id HYM\n\\toc3 Only short\n\\c 1\n\\p\n" },
    ]);
    expect(t3.nonStandard[0]?.displayLabel).toBe("Only short");

    const codeOnly = buildUsfmBookPickerGroups([
      { id: "1", usfm: "\\id HYM\n\\c 1\n\\p\n" },
    ]);
    expect(codeOnly.nonStandard[0]?.displayLabel).toBe("HYM");
  });

  it("uses \\toc3 for OT/NT and falls back to code", () => {
    const withToc = buildUsfmBookPickerGroups([
      { id: "1", usfm: "\\id PSA\n\\toc3 Ps\n\\c 1\n\\p\n" },
    ]);
    expect(withToc.oldTestament[0]?.displayLabel).toBe("Ps");

    const noToc = buildUsfmBookPickerGroups([
      { id: "1", usfm: "\\id ROM\n\\c 1\n\\p\n" },
    ]);
    expect(noToc.newTestament[0]?.displayLabel).toBe("ROM");
  });

  it("uses \\toc1 then \\toc2 then \\toc3 for standard non-OT/NT books", () => {
    const groups = buildUsfmBookPickerGroups([
      {
        id: "f",
        usfm: `\\id FRT
\\toc2 Front matter short
\\toc3 Frt
\\c 1
\\p
`,
      },
    ]);
    expect(groups.other[0]?.displayLabel).toBe("Front matter short");
    expect(groups.nonStandard).toHaveLength(0);
  });

  it("places deuterocanon and peripherals in other", () => {
    const groups = buildUsfmBookPickerGroups([
      { id: "t", usfm: "\\id TOB\n\\toc1 Tobit\n\\c 1\n\\p\n" },
      { id: "f", usfm: "\\id FRT\n\\toc1 Front\n\\c 1\n\\p\n" },
    ]);
    expect(groups.other.map((b) => b.code)).toEqual(["TOB", "FRT"]);
    expect(groups.nonStandard).toHaveLength(0);
  });
});
