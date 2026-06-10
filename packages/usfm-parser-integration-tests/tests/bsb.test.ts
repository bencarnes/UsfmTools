import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { parse } from "@usfm-tools/parser";
import type {
  BookNode,
  ChapterNode,
  VerseNode,
  ParagraphNode,
  CharNode,
  NoteNode,
  TextNode,
  UsfmNode,
  ParentNode,
  ParseResult,
} from "@usfm-tools/parser";
const BSB_DIR = new URL("../../../bibles/bsb/usfm/", import.meta.url);

function loadUsfm(filename: string): string {
  return Deno.readTextFileSync(new URL(filename, BSB_DIR));
}

function allUsfmFiles(): string[] {
  const files: string[] = [];
  for (const entry of Deno.readDirSync(BSB_DIR)) {
    if (entry.isFile && entry.name.endsWith(".usfm")) {
      files.push(entry.name);
    }
  }
  return files.sort();
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

/**
 * Collect sibling nodes that follow a verse milestone in a parent container.
 * Walks all paragraphs in the parent looking for the verse, then returns
 * siblings until the next verse or end of paragraph.
 */
function collectAfterVerse(parent: ParentNode, verseNumber: string): UsfmNode[] {
  for (const child of parent.children) {
    if (!("children" in child)) continue;
    const paraChildren = (child as ParentNode).children;
    let collecting = false;
    const result: UsfmNode[] = [];
    for (const node of paraChildren) {
      if (node.type === "verse") {
        if ((node as VerseNode).number === verseNumber) {
          collecting = true;
          continue;
        } else if (collecting) {
          return result;
        }
      }
      if (collecting) result.push(node);
    }
    if (collecting) return result;
  }
  return [];
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

      // Verse is a milestone — collect text siblings after it
      const afterV1 = collectAfterVerse(ch1!, "1");
      expect(afterV1.length).toBeGreaterThan(0);
      const text = collectText(afterV1);
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
      expect(ch1).toBeDefined();

      const afterV1 = collectAfterVerse(ch1!, "1");
      expect(afterV1.length).toBeGreaterThan(0);
      const text = collectText(afterV1);
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
    it("should parse all 66 BSB books with zero errors", () => {
      let totalErrors = 0;
      const sampleErrors: { file: string; message: string }[] = [];

      for (const file of files) {
        const content = loadUsfm(file);
        const result = parse(content);
        totalErrors += result.errors.length;
        for (const e of result.errors.slice(0, 3)) {
          sampleErrors.push({ file, message: e.message });
        }
      }

      if (sampleErrors.length > 0) {
        console.log("Unexpected errors:", sampleErrors);
      }
      expect(totalErrors).toBe(0);
    });
  });
});
