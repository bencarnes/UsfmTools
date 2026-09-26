import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  buildUsfmBookPickerGroups,
  buildUsfmFilePickerGroups,
} from "../src/book-identifiers/index.js";

describe("buildUsfmFilePickerGroups", () => {
  it("orders Old and New Testament by standard table number, not input order", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "b", name: "40-MAT.usfm", usfm: "\\id MAT\n\\toc3 Mat\n\\c 1\n\\p\n" },
      { id: "a", name: "01-GEN.usfm", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament.map((b) => b.code)).toEqual(["GEN"]);
    expect(groups.newTestament.map((b) => b.code)).toEqual(["MAT"]);
    expect(groups.oldTestament[0]?.displayLabel).toBe("01-GEN.usfm");
    expect(groups.newTestament[0]?.displayLabel).toBe("40-MAT.usfm");
  });

  it("uses file names for labels even when toc markers are present", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "1", name: "my-psalms.usfm", usfm: "\\id PSA\n\\toc3 Ps\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament[0]?.displayLabel).toBe("my-psalms.usfm");
  });

  it("places non-standard files in nonStandard with file names", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "x", name: "custom-a.usfm", usfm: "\\id ZZZ\n\\toc1 Custom A\n\\c 1\n\\p\n" },
      { id: "y", name: "no-id.usfm", usfm: "\\no id here\n" },
      { id: "z", name: "custom-b.usfm", usfm: "\\id ABC\n\\toc1 Custom B\n\\c 1\n\\p\n" },
    ]);
    expect(groups.nonStandard.map((b) => b.displayLabel)).toEqual([
      "custom-a.usfm",
      "custom-b.usfm",
      "no-id.usfm",
    ]);
  });

  it("sorts ties by file name when book table order matches", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "b", name: "GEN-b.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
      { id: "a", name: "GEN-a.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament.map((b) => b.displayLabel)).toEqual(["GEN-a.usfm", "GEN-b.usfm"]);
  });

  it("includes files with no \\id as non-standard using the file name", () => {
    const groups = buildUsfmFilePickerGroups([
      {
        id: "hymn-file",
        name: "hymnal.usfm",
        usfm: `\\toc1 Standalone hymnal
\\c 1
\\p
`,
      },
    ]);
    expect(groups.nonStandard).toHaveLength(1);
    expect(groups.nonStandard[0]?.code).toBe("");
    expect(groups.nonStandard[0]?.displayLabel).toBe("hymnal.usfm");
  });

  it("groups standard books without \\toc3 from \\id alone", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "1", name: "ROM.usfm", usfm: "\\id ROM\n\\c 1\n\\p\n" },
      { id: "2", name: "PSA.usfm", usfm: "\\id PSA\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament.map((b) => b.displayLabel)).toEqual(["PSA.usfm"]);
    expect(groups.newTestament.map((b) => b.displayLabel)).toEqual(["ROM.usfm"]);
  });

  it("lists every file when multiple copies share the same standard \\id", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "draft", name: "GEN-draft.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
      { id: "final", name: "GEN-final.usfm", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
      { id: "backup", name: "GEN-backup.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
    ]);
    expect(groups.oldTestament.map((b) => b.fileId)).toEqual(["backup", "draft", "final"]);
    expect(groups.oldTestament.map((b) => b.displayLabel)).toEqual([
      "GEN-backup.usfm",
      "GEN-draft.usfm",
      "GEN-final.usfm",
    ]);
    expect(groups.oldTestament.map((b) => b.code)).toEqual(["GEN", "GEN", "GEN"]);
  });

  it("places deuterocanon and peripherals in other", () => {
    const groups = buildUsfmFilePickerGroups([
      { id: "t", name: "TOB.usfm", usfm: "\\id TOB\n\\toc1 Tobit\n\\c 1\n\\p\n" },
      { id: "f", name: "FRT.usfm", usfm: "\\id FRT\n\\toc1 Front\n\\c 1\n\\p\n" },
    ]);
    expect(groups.other.map((b) => b.displayLabel)).toEqual(["TOB.usfm", "FRT.usfm"]);
    expect(groups.nonStandard).toHaveLength(0);
  });
  it("groups the same files as the parse-based book picker", async () => {
    const dir = new URL("../../../bibles/bsb/usfm/", import.meta.url);
    const files: { id: string; name: string; usfm: string }[] = [];
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.name.endsWith(".usfm")) continue;
      files.push({ id: entry.name, name: entry.name, usfm: await Deno.readTextFile(new URL(entry.name, dir)) });
    }
    files.push(
      { id: "empty-id", name: "empty-id.usfm", usfm: "\\id\n\\toc1 T\n" },
      { id: "no-id", name: "no-id.usfm", usfm: "\\toc1 T\n\\c 1\n" },
      { id: "lower", name: "lower.usfm", usfm: "\\id tob Tobit\n" },
      { id: "custom", name: "custom.usfm", usfm: "\\id ZZZ\n" },
      { id: "blank", name: "blank.usfm", usfm: "  \n" },
    );
    const summarize = (g: ReturnType<typeof buildUsfmFilePickerGroups>) =>
      Object.fromEntries(
        Object.entries(g).map(([k, rows]) => [
          k,
          (rows as { fileId: string; code: string; sortIndex: number }[])
            .map((r) => `${r.fileId}:${r.code}:${r.sortIndex}`)
            .sort(),
        ]),
      );
    expect(summarize(buildUsfmFilePickerGroups(files))).toEqual(
      summarize(buildUsfmBookPickerGroups(files)),
    );
  });
});
