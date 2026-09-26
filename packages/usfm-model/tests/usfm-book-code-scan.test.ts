import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { scanUsfmBookCode } from "../src/book-identifiers/usfm-book-code-scan.js";

describe("scanUsfmBookCode", () => {
  it("reads the first token after \\id", () => {
    expect(scanUsfmBookCode("\\id GEN Genesis\n\\c 1")).toBe("GEN");
    expect(scanUsfmBookCode("\\toc1 x\n\\id  mat\t- BSB")).toBe("mat");
    expect(scanUsfmBookCode("\\id GEN\n\\id EXO")).toBe("GEN");
  });

  it("distinguishes an empty \\id from a missing one", () => {
    expect(scanUsfmBookCode("\\id\n\\h Genesis")).toBe("");
    expect(scanUsfmBookCode("\\id \\h Genesis")).toBe("");
    expect(scanUsfmBookCode("\\h Genesis\n\\c 1")).toBeUndefined();
    expect(scanUsfmBookCode("")).toBeUndefined();
  });

  it("ignores escaped, end, and attribute-quoted \\id", () => {
    expect(scanUsfmBookCode("\\\\id GEN")).toBeUndefined();
    expect(scanUsfmBookCode("\\id* GEN")).toBeUndefined();
    expect(scanUsfmBookCode('\\w x|a="\\id GEN"\\w*\n\\id EXO')).toBe("EXO");
    expect(scanUsfmBookCode("\\+id GEN")).toBe("GEN");
  });

  it("reads an \\id after an unclosed \\fig", () => {
    // An unclosed figure ends at the next structural marker
    expect(scanUsfmBookCode("\\fig \\id GEN")).toBe("GEN");
  });

  it("still reports an \\id after an unclosed \\esb (known divergence)", () => {
    // The parser nests it into the sidebar; USFM requires \id first.
    expect(scanUsfmBookCode("\\esb\\id GEN")).toBe("GEN");
  });

  it("reads each BSB book's code (named after its file)", async () => {
    const dir = new URL("../../../bibles/bsb/usfm/", import.meta.url);
    let files = 0;
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.name.endsWith(".usfm")) continue;
      const text = await Deno.readTextFile(new URL(entry.name, dir));
      expect({ file: entry.name, code: scanUsfmBookCode(text) }).toEqual({
        file: entry.name,
        code: entry.name.replace(/\.usfm$/, ""),
      });
      files++;
    }
    expect(files).toBe(66);
  });
});
