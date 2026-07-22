import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { createLocalLanguageClient } from "../src/language-service/local-client.js";
import {
  chapterStructureFromEngine,
  chapterStructureFromText,
  EMPTY_CHAPTER_STRUCTURE,
} from "../src/components/usfm-pane/chapter-structure.js";

const settle = () => new Promise((r) => setTimeout(r, 0));

/** Structure of `text` as the client (real parse) reports it. */
async function fromClient(text: string) {
  const client = createLocalLanguageClient();
  await client.openDocument("d", 1, text);
  const result = await client.getStructure("d");
  await client.closeDocument("d");
  return chapterStructureFromEngine(result);
}

describe("chapterStructureFromEngine", () => {
  it("returns empty structure with no books", () => {
    expect(chapterStructureFromEngine({ version: 1, books: [] })).toEqual(EMPTY_CHAPTER_STRUCTURE);
  });

  it("uses only the first book's chapters", () => {
    const s = chapterStructureFromEngine({
      version: 1,
      books: [
        {
          code: "GEN",
          position: { line: 0, column: 0, offset: 0 },
          chapters: [
            { number: "1", position: { line: 1, column: 0, offset: 8 } },
            { number: "2", position: { line: 3, column: 0, offset: 20 } },
          ],
        },
        {
          code: "EXO",
          position: { line: 5, column: 0, offset: 40 },
          chapters: [{ number: "1", position: { line: 6, column: 0, offset: 48 } }],
        },
      ],
    });
    expect(s.hasBookId).toBe(true);
    expect(s.bookStartOffset).toBe(0);
    expect(s.markers).toEqual([
      { number: "1", markerOffset: 8 },
      { number: "2", markerOffset: 20 },
    ]);
  });
});

describe("engine structure agrees with the regex scan", () => {
  const cases: Record<string, string> = {
    "typical book": "\\id GEN Genesis\n\\c 1\n\\p\n\\v 1 A.\n\\c 2\n\\p\n\\v 1 B.\n\\c 3\n\\p\n\\v 1 C.",
    "leading whitespace before id": "  \\id GEN\n\\c 1\n\\p\n\\v 1 A.",
    "no chapters": "\\id FRT\n\\p\n\\v 1 Front matter.",
    "no id": "\\p\n\\v 1 loose text\n\\c 1\n\\p\n\\v 1 A.",
    "non-ascii verses": "\\id GEN\n\\c 1\n\\p\n\\v 1 “Quoted” — dash.\n\\c 2\n\\p\n\\v 1 More.",
  };

  for (const [name, text] of Object.entries(cases)) {
    it(name, async () => {
      const fromEngine = await fromClient(text);
      const fromText = chapterStructureFromText(text);
      expect(fromEngine).toEqual(fromText);
    });
  }

  it("tracks offsets across a full multi-chapter book", async () => {
    let text = "\\id PSA Psalms\n";
    for (let c = 1; c <= 30; c++) {
      text += `\\c ${c}\n\\p\n\\v 1 Verse of chapter ${c}.\n`;
    }
    const fromEngine = await fromClient(text);
    const fromText = chapterStructureFromText(text);
    expect(fromEngine.markers).toHaveLength(30);
    expect(fromEngine).toEqual(fromText);
    // Spot-check that offsets actually point at the "\\c" markers.
    for (const m of fromEngine.markers) {
      expect(text.slice(m.markerOffset, m.markerOffset + 2)).toBe("\\c");
    }
    await settle();
  });
});
