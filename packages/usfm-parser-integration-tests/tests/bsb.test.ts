import { describe, it, expect } from "vitest";
import { parse } from "@usfm-tools/parser";
import type {
  BookNode,
  ChapterNode,
  VerseNode,
  ParagraphNode,
  CharNode,
  NoteNode,
  TextNode,
  ParseResult,
} from "@usfm-tools/parser";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BSB_DIR = join(__dirname, "../../../bibles/bsb/usfm");

function loadUsfm(filename: string): string {
  return readFileSync(join(BSB_DIR, filename), "utf-8");
}

function allUsfmFiles(): string[] {
  return readdirSync(BSB_DIR)
    .filter((f) => f.endsWith(".usfm"))
    .sort();
}

function findChild<T>(
  children: { type: string }[],
  type: string,
  predicate?: (node: T) => boolean,
): T | undefined {
  return children.find(
    (c) => c.type === type && (!predicate || predicate(c as T)),
  ) as T | undefined;
}

function filterChildren<T>(children: { type: string }[], type: string): T[] {
  return children.filter((c) => c.type === type) as T[];
}

function collectText(children: { type: string; text?: string }[]): string {
  return children
    .filter((c) => c.type === "text")
    .map((c) => (c as TextNode).text)
    .join("");
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("BSB Integration Tests", () => {
  const files = allUsfmFiles();

  // -------------------------------------------------------------------------
  // 1. All 66 books parse without throwing
  // -------------------------------------------------------------------------

  describe("parse all books without exceptions", () => {
    it("should find exactly 66 USFM files", () => {
      expect(files).toHaveLength(66);
    });

    it("should parse every book in non-strict mode without throwing", () => {
      for (const file of files) {
        const content = loadUsfm(file);
        expect(() => parse(content)).not.toThrow();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Performance: entire Bible under 30 seconds
  // -------------------------------------------------------------------------

  describe("performance", () => {
    it("should parse the entire BSB in under 30 seconds", () => {
      const start = performance.now();
      for (const file of files) {
        const content = loadUsfm(file);
        parse(content);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(30_000);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Sampled structural assertions
  // -------------------------------------------------------------------------

  describe("sampled output: Genesis", () => {
    let result: ParseResult;

    it("should parse without throwing", () => {
      result = parse(loadUsfm("GEN.usfm"));
    });

    it("should have a book node with code GEN", () => {
      const book = result.document.children[0] as BookNode;
      expect(book.type).toBe("book");
      expect(book.code).toBe("GEN");
    });

    it("should have 50 chapters", () => {
      const book = result.document.children[0] as BookNode;
      const chapters = filterChildren<ChapterNode>(book.children, "chapter");
      expect(chapters).toHaveLength(50);
      expect(chapters[0].number).toBe("1");
      expect(chapters[49].number).toBe("50");
    });

    it("should have verse 1 in chapter 1 with expected text", () => {
      const book = result.document.children[0] as BookNode;
      const ch1 = findChild<ChapterNode>(book.children, "chapter");
      expect(ch1).toBeDefined();

      const allVerses: VerseNode[] = [];
      for (const child of ch1!.children) {
        if (child.type === "verse") allVerses.push(child as VerseNode);
        if (child.type === "paragraph") {
          for (const gc of (child as ParagraphNode).children) {
            if (gc.type === "verse") allVerses.push(gc as VerseNode);
          }
        }
      }

      const v1 = allVerses.find((v) => v.number === "1");
      expect(v1).toBeDefined();
      const text = collectText(v1!.children);
      expect(text).toContain("In the beginning God created");
    });

    it("should contain a section heading 'The Creation'", () => {
      const book = result.document.children[0] as BookNode;
      const ch1 = findChild<ChapterNode>(book.children, "chapter");

      const s1 = findChild<ParagraphNode>(
        ch1!.children,
        "paragraph",
        (p: ParagraphNode) => p.marker === "s1",
      );
      expect(s1).toBeDefined();
      const text = collectText(s1!.children);
      expect(text).toContain("The Creation");
    });
  });

  describe("sampled output: Psalms", () => {
    let result: ParseResult;

    it("should parse without throwing", () => {
      result = parse(loadUsfm("PSA.usfm"));
    });

    it("should have book code PSA with 150 chapters", () => {
      const book = result.document.children[0] as BookNode;
      expect(book.code).toBe("PSA");
      const chapters = filterChildren<ChapterNode>(book.children, "chapter");
      expect(chapters).toHaveLength(150);
    });

    it("should have poetry formatting (q1/q2 markers)", () => {
      const book = result.document.children[0] as BookNode;
      const ch1 = findChild<ChapterNode>(book.children, "chapter");
      const paras = filterChildren<ParagraphNode>(ch1!.children, "paragraph");
      const poetryMarkers = paras
        .map((p) => p.marker)
        .filter((m) => m.startsWith("q"));
      expect(poetryMarkers.length).toBeGreaterThan(0);
      expect(poetryMarkers).toContain("q1");
      expect(poetryMarkers).toContain("q2");
    });

    it("should have 'Blessed is the man' in Psalm 1:1", () => {
      const book = result.document.children[0] as BookNode;
      const ch1 = findChild<ChapterNode>(book.children, "chapter");
      const allVerses: VerseNode[] = [];
      for (const child of ch1!.children) {
        if (child.type === "verse") allVerses.push(child as VerseNode);
        if (child.type === "paragraph") {
          for (const gc of (child as ParagraphNode).children) {
            if (gc.type === "verse") allVerses.push(gc as VerseNode);
          }
        }
      }
      const v1 = allVerses.find((v) => v.number === "1");
      expect(v1).toBeDefined();
      const text = collectText(v1!.children);
      expect(text).toContain("Blessed is the man");
    });
  });

  describe("sampled output: Matthew", () => {
    let result: ParseResult;

    it("should parse without throwing", () => {
      result = parse(loadUsfm("MAT.usfm"));
    });

    it("should have book code MAT with 28 chapters", () => {
      const book = result.document.children[0] as BookNode;
      expect(book.code).toBe("MAT");
      const chapters = filterChildren<ChapterNode>(book.children, "chapter");
      expect(chapters).toHaveLength(28);
    });

    it("should have a header 'Matthew'", () => {
      const book = result.document.children[0] as BookNode;
      const header = findChild<ParagraphNode>(
        book.children,
        "paragraph",
        (p: ParagraphNode) => p.marker === "h",
      );
      expect(header).toBeDefined();
      const text = collectText(header!.children);
      expect(text).toContain("Matthew");
    });

    it("should contain footnotes in chapter 1", () => {
      const book = result.document.children[0] as BookNode;
      const ch1 = findChild<ChapterNode>(book.children, "chapter");

      const notes: NoteNode[] = [];
      const walk = (children: { type: string }[]) => {
        for (const c of children) {
          if (c.type === "note") notes.push(c as NoteNode);
          if ("children" in c) walk((c as { children: { type: string }[] }).children);
        }
      };
      walk(ch1!.children);

      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].marker).toBe("f");
      expect(notes[0].caller).toBe("+");
    });
  });

  describe("sampled output: Revelation (last book)", () => {
    let result: ParseResult;

    it("should parse without throwing", () => {
      result = parse(loadUsfm("REV.usfm"));
    });

    it("should have book code REV with 22 chapters", () => {
      const book = result.document.children[0] as BookNode;
      expect(book.code).toBe("REV");
      const chapters = filterChildren<ChapterNode>(book.children, "chapter");
      expect(chapters).toHaveLength(22);
    });

    it("should contain \\wj (words of Jesus) char nodes", () => {
      const book = result.document.children[0] as BookNode;
      const ch1 = findChild<ChapterNode>(book.children, "chapter");

      const wjNodes: CharNode[] = [];
      const walk = (children: { type: string }[]) => {
        for (const c of children) {
          if (c.type === "char" && (c as CharNode).marker === "wj") {
            wjNodes.push(c as CharNode);
          }
          if ("children" in c) walk((c as { children: { type: string }[] }).children);
        }
      };
      walk(ch1!.children);

      expect(wjNodes.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Error analysis — characterize parser limitations vs real USFM errors
  // -------------------------------------------------------------------------

  describe("error characterization", () => {
    let allErrors: { file: string; message: string }[];

    it("should collect errors from all books", () => {
      allErrors = [];
      for (const file of files) {
        const content = loadUsfm(file);
        const result = parse(content);
        for (const e of result.errors) {
          allErrors.push({ file, message: e.message });
        }
      }
      expect(allErrors.length).toBeGreaterThan(0);
    });

    it("should have errors predominantly from \\ref (a known parser limitation)", () => {
      const refUnknown = allErrors.filter((e) =>
        e.message.includes("Unknown marker '\\ref'"),
      );
      const refStray = allErrors.filter((e) =>
        e.message.includes("Unexpected end marker '\\ref*'"),
      );
      const refAttrib = allErrors.filter((e) =>
        e.message.includes("Attribute data not attached"),
      );

      // \ref is a valid USFM 3.x marker used inline in BSB for cross-references
      // (e.g. \ref John 1:1–5|JHN 1:1-5\ref*). Our parser currently treats it
      // as unknown in inline context because it's classified as "internal" and
      // only handled at the top level. Each \ref occurrence produces three errors:
      // unknown marker, unattached attribute, and stray end marker.
      expect(refUnknown.length).toBeGreaterThan(0);
      expect(refStray.length).toBe(refUnknown.length);

      // These three categories should account for the vast majority of errors
      const refRelated = refUnknown.length + refStray.length + refAttrib.length;
      expect(refRelated / allErrors.length).toBeGreaterThan(0.9);
    });

    it("should have stray \\wj* end markers from cross-verse spans (a known parser limitation)", () => {
      const wjStray = allErrors.filter((e) =>
        e.message.includes("Unexpected end marker '\\wj*'"),
      );

      // \wj (words of Jesus) sometimes spans across verse boundaries in BSB.
      // The parser's parseChar() breaks at \v markers, so the closing \wj*
      // appears orphaned. This is a parser limitation, not a USFM error.
      expect(wjStray.length).toBeGreaterThan(0);
    });

    it("should have no error types other than \\ref and \\wj limitations", () => {
      const unexpectedErrors = allErrors.filter(
        (e) =>
          !e.message.includes("\\ref") &&
          !e.message.includes("\\wj*") &&
          !e.message.includes("Attribute data not attached"),
      );
      expect(unexpectedErrors).toHaveLength(0);
    });
  });
});
