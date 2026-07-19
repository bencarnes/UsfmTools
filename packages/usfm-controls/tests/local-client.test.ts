import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  applyChangesToText,
  createLocalLanguageClient,
} from "../src/language-service/local-client.js";
import type { AnalysisEvent } from "../src/language-service/protocol.js";

const GOOD = "\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning\n";
const BAD = "\\id GEN\n\\zzz what\n";

function client() {
  // No debounce so tests do not need timer control.
  return createLocalLanguageClient({ analysisDebounceMs: 0 });
}

function nextAnalysis(c: ReturnType<typeof client>): Promise<AnalysisEvent> {
  return new Promise((resolve) => {
    const unsubscribe = c.onAnalysis((event) => {
      unsubscribe();
      resolve(event);
    });
  });
}

describe("applyChangesToText", () => {
  it("applies ascending batches addressing the original text", () => {
    expect(
      applyChangesToText("hello world", [
        { from: 0, to: 5, text: "goodbye" },
        { from: 6, to: 11, text: "moon" },
      ]),
    ).toBe("goodbye moon");
  });

  it("handles pure insertions", () => {
    expect(applyChangesToText("ab", [{ from: 1, to: 1, text: "X" }])).toBe("aXb");
  });

  it("rejects overlapping ranges", () => {
    expect(() =>
      applyChangesToText("abcdef", [
        { from: 0, to: 3, text: "x" },
        { from: 2, to: 4, text: "y" },
      ]),
    ).toThrow();
  });

  it("rejects out-of-bounds ranges", () => {
    expect(() => applyChangesToText("ab", [{ from: 0, to: 5, text: "x" }])).toThrow();
  });
});

describe("createLocalLanguageClient", () => {
  it("pushes an analysis after open", async () => {
    const c = client();
    const analysis = nextAnalysis(c);
    await c.openDocument("doc", 1, BAD);
    const event = await analysis;
    expect(event.id).toBe("doc");
    expect(event.version).toBe(1);
    expect(event.diagnostics).toHaveLength(1);
    expect(event.diagnostics[0].message).toContain("Unknown marker");
  });

  it("enriches diagnostic positions with document offsets", async () => {
    const c = client();
    await c.openDocument("doc", 1, BAD);
    const { diagnostics } = await c.getDiagnostics("doc");
    // \zzz starts at line 1 column 0 = offset 8.
    expect(diagnostics[0].range.start.offset).toBe(8);
  });

  it("applies incremental changes and re-analyzes", async () => {
    const c = client();
    await c.openDocument("doc", 1, GOOD);
    const analysis = nextAnalysis(c);
    // Replace "\p" (offsets 13..15) with an unknown marker.
    await c.applyChanges("doc", 2, [{ from: 13, to: 15, text: "\\zzz" }]);
    const event = await analysis;
    expect(event.version).toBe(2);
    expect(event.diagnostics).toHaveLength(1);
  });

  it("rejects stale versions and unknown documents", async () => {
    const c = client();
    await c.openDocument("doc", 5, GOOD);
    await expect(c.applyChanges("doc", 5, [])).rejects.toThrow("stale");
    await expect(c.applyChanges("nope", 1, [])).rejects.toThrow("not open");
    await expect(c.openDocument("doc", 1, "")).rejects.toThrow("already open");
  });

  it("serves classification and completions from the synced copy", async () => {
    const c = client();
    await c.openDocument("doc", 1, GOOD);
    const whole = await c.classifyDocument("doc");
    expect(whole.tokens.length).toBeGreaterThan(0);
    const range = await c.classifyRange("doc", 0, 7);
    expect(range.tokens).toHaveLength(1);
    expect(range.tokens[0].type).toBe("marker");
    // "\v" prefix on line 3 at column 2.
    const items = await c.getCompletions("doc", 3, 2);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.label.startsWith("\\v"))).toBe(true);
  });

  it("returns the book/chapter structure", async () => {
    const c = client();
    await c.openDocument("doc", 1, "\\id GEN Genesis\n\\c 1\n\\p\n\\v 1 x\n\\c 2\n");
    const { books } = await c.getStructure("doc");
    expect(books).toHaveLength(1);
    expect(books[0].code).toBe("GEN");
    expect(books[0].chapters.map((ch) => ch.number)).toEqual(["1", "2"]);
  });

  it("renders preview HTML from the synced copy by document id", async () => {
    const c = client();
    await c.openDocument("doc", 3, GOOD);
    const result = await c.renderPreviewDocument("doc");
    expect(result.version).toBe(3);
    expect(result.html).toBe(await c.renderPreview(GOOD));
    await expect(c.renderPreviewDocument("nope")).rejects.toThrow("not open");
  });

  it("stops pushing after close", async () => {
    const c = client();
    await c.openDocument("doc", 1, GOOD);
    await c.closeDocument("doc");
    await expect(c.getDiagnostics("doc")).rejects.toThrow("not open");
    await expect(c.closeDocument("doc")).rejects.toThrow("not open");
  });
});
