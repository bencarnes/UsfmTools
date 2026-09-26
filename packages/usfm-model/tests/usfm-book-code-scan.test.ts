import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { parse, type BookNode } from "@usfm-tools/parser";
import { scanUsfmBookCode } from "../src/book-identifiers/usfm-book-code-scan.js";

/** Reference: the code of the parser's first book node. */
function parsedBookCode(usfm: string): string | undefined {
  const book = parse(usfm).document.children.find((c) => c.type === "book") as
    | BookNode
    | undefined;
  return book?.code;
}

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

  it("agrees with the parser on an \\id after an unclosed \\fig", () => {
    // An unclosed figure ends at the next structural marker
    expect(scanUsfmBookCode("\\fig \\id GEN")).toBe("GEN");
    expect(parsedBookCode("\\fig \\id GEN")).toBe("GEN");
  });

  it("still reports an \\id after an unclosed \\esb (known divergence)", () => {
    // The parser nests it into the sidebar; USFM requires \id first.
    expect(scanUsfmBookCode("\\esb\\id GEN")).toBe("GEN");
    expect(parsedBookCode("\\esb\\id GEN")).toBeUndefined();
  });

  it("matches the parser across the BSB corpus", async () => {
    const dir = new URL("../../../bibles/bsb/usfm/", import.meta.url);
    let files = 0;
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.name.endsWith(".usfm")) continue;
      const text = await Deno.readTextFile(new URL(entry.name, dir));
      expect({ file: entry.name, code: scanUsfmBookCode(text) }).toEqual({
        file: entry.name,
        code: parsedBookCode(text),
      });
      files++;
    }
    expect(files).toBe(66);
  });

  it("matches the parser on randomized marker soup", () => {
    // Excludes \esb (see the known divergence above).
    const pieces = [
      "\\fig ", "\\fig*",
      "\\", "\\\\", "id", "id*", "+", "|", '"', "=", "a", "x=", " ", "\t", "\n", "\r",
      "/", "//", "~", "*", "GEN", "exo Exodus", "\\c 1", "\\p ", "\\v 2 ", "\\f + ",
      "\\f*", "\\w ", "\\w*", "\\toc1 T", "\\id ", "\\+id ", "\\\n", "\\x - ", "\\x*",
      "\\tr ", "\\tc1 ", "\\qt-s ", "\\*", "\\ts\\*", "\\esbe", "\\periph ", "\\rq ", "\\z ",
    ];
    // Deterministic PRNG (mulberry32) so failures reproduce.
    let seed = 0x5eed;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let iter = 0; iter < 20000; iter++) {
      const len = 1 + Math.floor(rand() * 16);
      let text = "";
      for (let k = 0; k < len; k++) text += pieces[Math.floor(rand() * pieces.length)];
      const expected = parsedBookCode(text);
      const actual = scanUsfmBookCode(text);
      if (actual !== expected) {
        throw new Error(
          `mismatch for ${JSON.stringify(text)}: scan=${JSON.stringify(actual)} parse=${
            JSON.stringify(expected)
          }`,
        );
      }
    }
  });
});
