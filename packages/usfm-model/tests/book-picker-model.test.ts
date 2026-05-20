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
  });

  it("skips files without a valid standard \\id", () => {
    const groups = buildUsfmBookPickerGroups([
      { id: "x", usfm: "\\id ZZZ\n\\c 1\n\\p\n" },
      { id: "y", usfm: "\\no id here\n" },
    ]);
    expect(groups.oldTestament).toHaveLength(0);
    expect(groups.newTestament).toHaveLength(0);
    expect(groups.other).toHaveLength(0);
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

  it("uses \\toc1 then \\toc2 then \\toc3 for non-OT/NT books", () => {
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
  });

  it("places deuterocanon and peripherals in other", () => {
    const groups = buildUsfmBookPickerGroups([
      { id: "t", usfm: "\\id TOB\n\\toc1 Tobit\n\\c 1\n\\p\n" },
      { id: "f", usfm: "\\id FRT\n\\toc1 Front\n\\c 1\n\\p\n" },
    ]);
    expect(groups.other.map((b) => b.code)).toEqual(["TOB", "FRT"]);
  });
});
