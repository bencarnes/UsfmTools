import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { buildUsfmFilePickerGroups } from "../src/book-identifiers/usfm-file-picker-model.js";
import {
  scanUsfmPickerHeader,
  scanUsfmPickerHeaderFromText,
} from "../src/book-identifiers/usfm-picker-header-scan.js";

describe("scanUsfmPickerHeaderFromText", () => {
  it("stops before the first chapter marker", () => {
    const full = "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n\\v 1 Hello world.";
    const scanned = scanUsfmPickerHeaderFromText(full);
    expect(scanned.headerUsfm).toBe("\\id GEN\n\\toc3 Gen");
    expect(scanned.isNonempty).toBe(true);
    expect(scanned.headerUsfm).not.toContain("Hello");
  });

  it("treats whitespace-only files as empty", () => {
    const scanned = scanUsfmPickerHeaderFromText("  \n\t\n");
    expect(scanned.isNonempty).toBe(false);
    expect(scanned.headerUsfm).toBe("");
  });

  it("indexes files that start with a chapter marker without reading the body", () => {
    const full = "\\c 1\n\\p\n\\v 1 Only chapter body.";
    const scanned = scanUsfmPickerHeaderFromText(full);
    expect(scanned.headerUsfm).toBe("\\p\n");
    const fromFull = buildUsfmFilePickerGroups([
      { id: "a", name: "A.usfm", usfm: full },
    ]);
    const fromHeader = buildUsfmFilePickerGroups([
      { id: "a", name: "A.usfm", usfm: scanned.headerUsfm },
    ]);
    expect(fromHeader).toEqual(fromFull);
  });
});

describe("scanUsfmPickerHeader", () => {
  it("reads lines until the chapter marker", async () => {
    const lines = ["\\id EXO", "\\toc3 Exo", "\\c 1", "\\v 1 Rest"];
    let i = 0;
    const scanned = await scanUsfmPickerHeader(async () => {
      if (i >= lines.length) return null;
      return lines[i++] ?? null;
    });
    expect(i).toBe(3);
    expect(scanned.headerUsfm).toBe("\\id EXO\n\\toc3 Exo");
  });
});
