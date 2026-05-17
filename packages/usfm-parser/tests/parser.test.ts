import { describe, it, expect } from "vitest";
import { parse } from "../src/index.js";
import type {
  BookNode,
  ChapterNode,
  VerseNode,
  ParagraphNode,
  CharNode,
  NoteNode,
  TextNode,
  MilestoneNode,
  RowNode,
  CellNode,
  UsfmNode,
  ParentNode,
} from "../src/types.js";

/**
 * Collect children from a ParentNode that follow a specific verse milestone.
 * Returns all sibling nodes after the verse marker until the next verse or end.
 */
function childrenAfterVerse(
  parent: ParentNode,
  verseNumber: string,
): UsfmNode[] {
  const children = parent.children;
  let collecting = false;
  const result: UsfmNode[] = [];
  for (const child of children) {
    if (child.type === "verse") {
      if ((child as VerseNode).number === verseNumber) {
        collecting = true;
        continue;
      } else if (collecting) {
        break;
      }
    }
    if (collecting) {
      result.push(child);
    }
  }
  return result;
}

describe("Parser", () => {
  describe("document structure", () => {
    it("should parse an empty string into an empty document", () => {
      const result = parse("");
      expect(result.document.type).toBe("document");
      expect(result.document.children).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should parse a minimal USFM file", () => {
      const input = `\\id GEN Genesis
\\c 1
\\p
\\v 1 In the beginning God created the heavens and the earth.`;
      const result = parse(input);
      expect(result.document.type).toBe("document");
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("book identification", () => {
    it("should parse \\id marker with book code", () => {
      const result = parse("\\id GEN");
      const book = result.document.children[0] as BookNode;
      expect(book.type).toBe("book");
      expect(book.code).toBe("GEN");
    });

    it("should parse \\id marker with book code and description", () => {
      const result = parse("\\id GEN Genesis - English Standard Version");
      const book = result.document.children[0] as BookNode;
      expect(book.type).toBe("book");
      expect(book.code).toBe("GEN");
      expect(book.description).toBe("Genesis - English Standard Version");
    });

    it("should parse headers within a book", () => {
      const input = `\\id GEN
\\h Genesis
\\toc1 Genesis
\\toc2 Gen
\\mt1 Genesis`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      expect(book.type).toBe("book");
      expect(book.children.length).toBeGreaterThan(0);

      const headers = book.children.filter(
        (c) => c.type === "paragraph"
      ) as ParagraphNode[];
      const headerMarkers = headers.map((h) => h.marker);
      expect(headerMarkers).toContain("h");
      expect(headerMarkers).toContain("toc1");
      expect(headerMarkers).toContain("mt1");
    });
  });

  describe("chapters", () => {
    it("should parse chapter markers", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Text`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      expect(chapter).toBeDefined();
      expect(chapter.number).toBe("1");
    });

    it("should parse multiple chapters", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Chapter 1 text.
\\c 2
\\p
\\v 1 Chapter 2 text.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapters = book.children.filter(
        (c) => c.type === "chapter"
      ) as ChapterNode[];
      expect(chapters).toHaveLength(2);
      expect(chapters[0].number).toBe("1");
      expect(chapters[1].number).toBe("2");
    });
  });

  describe("verses", () => {
    it("should emit verse as a milestone node (no children)", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 In the beginning God created the heavens and the earth.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;
      const verse = para.children.find(
        (c) => c.type === "verse"
      ) as VerseNode;
      expect(verse).toBeDefined();
      expect(verse.number).toBe("1");
      expect("children" in verse).toBe(false);

      // Text follows the verse milestone as a sibling in the paragraph
      const afterVerse = childrenAfterVerse(para, "1");
      const textNodes = afterVerse.filter(
        (c) => c.type === "text"
      ) as TextNode[];
      const fullText = textNodes.map((t) => t.text).join("");
      expect(fullText).toContain("In the beginning");
    });

    it("should parse verse ranges", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1-2 Combined verse text.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;
      const verse = para.children.find(
        (c) => c.type === "verse"
      ) as VerseNode;
      expect(verse.number).toBe("1-2");
    });

    it("should parse multiple verses as sibling milestones in a paragraph", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 First verse.
\\v 2 Second verse.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;
      const verses = para.children.filter(
        (c) => c.type === "verse"
      ) as VerseNode[];
      expect(verses).toHaveLength(2);
      expect(verses[0].number).toBe("1");
      expect(verses[1].number).toBe("2");
    });
  });

  describe("paragraphs", () => {
    it("should parse paragraph markers", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Paragraph text.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;
      expect(para).toBeDefined();
      expect(para.marker).toBe("p");
    });

    it("should parse poetry markers", () => {
      const input = `\\id PSA
\\c 1
\\q1
\\v 1 Blessed is the man
\\q2 who walks not in the counsel of the wicked.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const paras = chapter.children.filter(
        (c) => c.type === "paragraph"
      ) as ParagraphNode[];
      const markers = paras.map((p) => p.marker);
      expect(markers).toContain("q1");
      expect(markers).toContain("q2");
    });

    it("should parse section headings", () => {
      const input = `\\id GEN
\\c 1
\\s1 The Creation
\\p
\\v 1 In the beginning.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const sectionHeading = chapter.children.find(
        (c) => c.type === "paragraph" && (c as ParagraphNode).marker === "s1"
      ) as ParagraphNode;
      expect(sectionHeading).toBeDefined();
    });
  });

  describe("character styles", () => {
    it("should parse inline character markers", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 The \\nd Lord\\nd* spoke.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      // \\nd is a sibling of the verse milestone in the paragraph
      const charNode = para.children.find(
        (c) => c.type === "char"
      ) as CharNode;
      expect(charNode).toBeDefined();
      expect(charNode.marker).toBe("nd");

      const textInChar = charNode.children.find(
        (c) => c.type === "text"
      ) as TextNode;
      expect(textInChar.text).toContain("Lord");
    });

    it("should parse word-level markup with key-value attributes", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\w grace|lemma="grace" strong="G5485"\\w*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const wNode = para.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "w"
      ) as CharNode;
      expect(wNode).toBeDefined();
      expect(wNode.attributes).toBeDefined();
      expect(wNode.attributes!["lemma"]).toBe("grace");
      expect(wNode.attributes!["strong"]).toBe("G5485");
    });

    it("should parse word-level markup with positional default attribute", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\w grace|grace\\w*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const wNode = para.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "w"
      ) as CharNode;
      expect(wNode).toBeDefined();
      expect(wNode.attributes).toBeDefined();
      expect(wNode.attributes!["lemma"]).toBe("grace");
    });

    it("should map positional attribute to correct default key per marker", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\rb 漢字|ルビ\\rb*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const rbNode = para.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "rb"
      ) as CharNode;
      expect(rbNode).toBeDefined();
      expect(rbNode.attributes).toBeDefined();
      expect(rbNode.attributes!["gloss"]).toBe("ルビ");
    });

    it("should use 'default' key when marker has no default attribute mapping", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\nd Lord|some value\\nd*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const ndNode = para.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "nd"
      ) as CharNode;
      expect(ndNode).toBeDefined();
      expect(ndNode.attributes).toBeDefined();
      expect(ndNode.attributes!["default"]).toBe("some value");
    });

    it("should parse nested character markers", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\wj words of \\+nd Jesus\\+nd*\\wj*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const wjNode = para.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "wj"
      ) as CharNode;
      expect(wjNode).toBeDefined();

      const nestedNd = wjNode.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "nd"
      ) as CharNode;
      expect(nestedNd).toBeDefined();
    });

    it("should allow char markers to span across verse boundaries", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Jesus said, \\wj "I am the First and the Last,
\\v 2 the Living One."\\wj*`;
      const result = parse(input);
      expect(result.errors).toHaveLength(0);

      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const wjNode = para.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "wj"
      ) as CharNode;
      expect(wjNode).toBeDefined();

      // The \\wj span should contain a verse milestone as a child
      const innerVerse = wjNode.children.find(
        (c) => c.type === "verse"
      ) as VerseNode;
      expect(innerVerse).toBeDefined();
      expect(innerVerse.number).toBe("2");
    });
  });

  describe("footnotes", () => {
    it("should parse a basic footnote", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Text\\f + \\fr 1:1 \\ft A footnote.\\f* more text.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      // Footnote is a sibling of the verse milestone in the paragraph
      const footnote = para.children.find(
        (c) => c.type === "note"
      ) as NoteNode;
      expect(footnote).toBeDefined();
      expect(footnote.marker).toBe("f");
      expect(footnote.caller).toBe("+");

      const frNode = footnote.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "fr"
      ) as CharNode;
      expect(frNode).toBeDefined();

      const ftNode = footnote.children.find(
        (c) => c.type === "char" && (c as CharNode).marker === "ft"
      ) as CharNode;
      expect(ftNode).toBeDefined();
    });

    it("should parse cross references", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Text\\x - \\xo 1:1 \\xt Gen 2:4\\x* more.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      const xref = para.children.find(
        (c) => c.type === "note"
      ) as NoteNode;
      expect(xref).toBeDefined();
      expect(xref.marker).toBe("x");
      expect(xref.caller).toBe("-");
    });
  });

  describe("tables", () => {
    it("should parse table rows and cells", () => {
      const input = `\\id GEN
\\c 1
\\tr \\th1 Name \\th2 Age
\\tr \\tc1 Adam \\tc2 930`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;

      const rows = chapter.children.filter(
        (c) => c.type === "row"
      ) as RowNode[];
      expect(rows).toHaveLength(2);

      const headerCells = rows[0].children.filter(
        (c) => c.type === "cell"
      ) as CellNode[];
      expect(headerCells).toHaveLength(2);
      expect(headerCells[0].marker).toBe("th1");
      expect(headerCells[1].marker).toBe("th2");
    });
  });

  describe("milestones", () => {
    it("should parse milestone markers", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\qt-s |who="God"\\*In the beginning.\\qt-e\\*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const para = chapter.children.find(
        (c) => c.type === "paragraph"
      ) as ParagraphNode;

      // Milestones are siblings of the verse milestone in the paragraph
      const milestones = para.children.filter(
        (c) => c.type === "milestone"
      ) as MilestoneNode[];
      expect(milestones.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("introduction content", () => {
    it("should parse introduction paragraphs", () => {
      const input = `\\id GEN
\\imt1 Introduction to Genesis
\\ip This is the first book of the Bible.`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;

      const introParts = book.children.filter(
        (c) => c.type === "paragraph"
      ) as ParagraphNode[];
      const markers = introParts.map((p) => p.marker);
      expect(markers).toContain("imt1");
      expect(markers).toContain("ip");
    });
  });

  describe("table row inline content", () => {
    it("should preserve text content in table rows outside cells", () => {
      const input = `\\id GEN
\\c 1
\\tr some text \\tc1 Cell content`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const row = chapter.children.find(
        (c) => c.type === "row"
      ) as RowNode;
      expect(row).toBeDefined();

      const textNodes = row.children.filter(
        (c) => c.type === "text"
      ) as TextNode[];
      expect(textNodes.length).toBeGreaterThan(0);
      const text = textNodes.map((t) => t.text).join("");
      expect(text).toContain("some text");
    });
  });

  describe("header inline content", () => {
    it("should parse char markers inside header lines", () => {
      const input = `\\id GEN
\\h The Book of \\bk Genesis\\bk*`;
      const result = parse(input);
      const book = result.document.children[0] as BookNode;
      const header = book.children.find(
        (c) => c.type === "paragraph" && (c as ParagraphNode).marker === "h"
      ) as ParagraphNode;
      expect(header).toBeDefined();

      const charNode = header.children.find(
        (c) => c.type === "char"
      ) as CharNode;
      expect(charNode).toBeDefined();
      expect(charNode.marker).toBe("bk");

      const charText = charNode.children.find(
        (c) => c.type === "text"
      ) as TextNode;
      expect(charText).toBeDefined();
      expect(charText.text).toContain("Genesis");
    });
  });

  describe("inline ref markers", () => {
    it("should parse \\ref as a ref node in inline context", () => {
      const input = `\\id GEN
\\c 1
\\s1 The Creation
\\r (\\ref John 1:1–5|JHN 1:1-5\\ref*; \\ref Hebrews 11:1–3|HEB 11:1-3\\ref*)`;
      const result = parse(input);
      expect(result.errors).toHaveLength(0);

      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      const rPara = chapter.children.find(
        (c) => c.type === "paragraph" && (c as ParagraphNode).marker === "r"
      ) as ParagraphNode;
      expect(rPara).toBeDefined();

      const refs = rPara.children.filter((c) => c.type === "ref");
      expect(refs).toHaveLength(2);
      expect(refs[0].marker).toBe("ref");
      expect(refs[0].attributes?.["loc"]).toBe("JHN 1:1-5");
      expect(refs[1].attributes?.["loc"]).toBe("HEB 11:1-3");
    });

    it("should parse \\ref inside footnotes", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Text\\f + \\fr 1:1 \\ft See \\ref Matthew 1:1|MAT 1:1\\ref*\\f*`;
      const result = parse(input);
      expect(result.errors).toHaveLength(0);

      const book = result.document.children[0] as BookNode;
      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;

      // Walk to find the ref node inside the footnote
      const walk = (children: { type: string }[]): UsfmNode | undefined => {
        for (const c of children) {
          if (c.type === "ref") return c as UsfmNode;
          if ("children" in c) {
            const found = walk((c as ParentNode).children);
            if (found) return found;
          }
        }
        return undefined;
      };
      const refNode = walk(chapter.children);
      expect(refNode).toBeDefined();
      expect(refNode!.type).toBe("ref");
      expect(refNode!.attributes?.["loc"]).toBe("MAT 1:1");
    });
  });

  describe("error handling", () => {
    it("should collect errors for unknown markers in non-strict mode", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\zzz Unknown marker.`;
      const result = parse(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain("Unknown marker");
    });

    it("should throw in strict mode", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 \\zzz Unknown marker.`;
      expect(() => parse(input, { strict: true })).toThrow();
    });

    it("should report errors for stray end markers at top level", () => {
      const input = `\\id GEN
\\nd*`;
      const result = parse(input);
      const endMarkerErrors = result.errors.filter(
        (e) => e.message.includes("Unexpected end marker")
      );
      expect(endMarkerErrors.length).toBeGreaterThan(0);
      expect(endMarkerErrors[0].message).toContain("\\nd*");
    });

    it("should report errors for stray end markers in inline context", () => {
      const input = `\\id GEN
\\c 1
\\p
\\v 1 Text \\bk* orphaned end marker.`;
      const result = parse(input);
      const endMarkerErrors = result.errors.filter(
        (e) => e.message.includes("Unexpected end marker")
      );
      expect(endMarkerErrors.length).toBeGreaterThan(0);
      expect(endMarkerErrors[0].message).toContain("\\bk*");
    });
  });

  describe("complete USFM file", () => {
    it("should parse a realistic USFM file", () => {
      const input = `\\id GEN English Standard Version
\\h Genesis
\\toc1 The First Book of Moses (Genesis)
\\toc2 Genesis
\\toc3 Gen
\\mt1 Genesis
\\c 1
\\s1 The Creation of the World
\\p
\\v 1 In the beginning, God created the heavens and the earth.
\\v 2 The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.
\\p
\\v 3 And God said, \\wj "Let there be light,"\\wj* and there was light.
\\v 4 And God saw that the light was good. And God separated the light from the darkness.
\\v 5 God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.
\\c 2
\\s1 The Seventh Day, God Rests
\\p
\\v 1 Thus the heavens and the earth were finished, and all the host of them.
\\v 2 And on the seventh day God finished his work that he had done, and he rested on the seventh day from all his work that he had done.`;

      const result = parse(input);
      expect(result.errors).toHaveLength(0);

      const book = result.document.children[0] as BookNode;
      expect(book.type).toBe("book");
      expect(book.code).toBe("GEN");

      const chapters = book.children.filter(
        (c) => c.type === "chapter"
      ) as ChapterNode[];
      expect(chapters).toHaveLength(2);
      expect(chapters[0].number).toBe("1");
      expect(chapters[1].number).toBe("2");

      const ch1Paras = chapters[0].children.filter(
        (c) => c.type === "paragraph"
      ) as ParagraphNode[];
      expect(ch1Paras.length).toBeGreaterThan(0);

      const sectionHeading = chapters[0].children.find(
        (c) => c.type === "paragraph" && (c as ParagraphNode).marker === "s1"
      ) as ParagraphNode;
      expect(sectionHeading).toBeDefined();
    });

    it("should parse Psalm-style poetry", () => {
      const input = `\\id PSA
\\h Psalms
\\mt1 Psalms
\\c 1
\\d A Psalm of David.
\\q1
\\v 1 Blessed is the man
\\q2 who walks not in the counsel of the wicked,
\\q1 nor stands in the way of sinners,
\\q2 nor sits in the seat of scoffers;
\\q1
\\v 2 but his delight is in the law of the \\nd Lord\\nd*,
\\q2 and on his law he meditates day and night.`;

      const result = parse(input);
      expect(result.errors).toHaveLength(0);

      const book = result.document.children[0] as BookNode;
      expect(book.code).toBe("PSA");

      const chapter = book.children.find(
        (c) => c.type === "chapter"
      ) as ChapterNode;
      expect(chapter.number).toBe("1");

      const paras = chapter.children.filter(
        (c) => c.type === "paragraph"
      ) as ParagraphNode[];
      const poetryMarkers = paras
        .map((p) => p.marker)
        .filter((m) => m.startsWith("q"));
      expect(poetryMarkers.length).toBeGreaterThan(0);
    });
  });

  describe("convenience parse function", () => {
    it("should work as a standalone function", () => {
      const result = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Hello world.");
      expect(result.document.type).toBe("document");
      expect(result.document.children.length).toBeGreaterThan(0);
    });
  });
});
