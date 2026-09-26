import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { renderPreviewHtml } from "../src/index.js";

const MULTI_VERSE = "\\id GEN\n\\c 1\n\\p\n\\v 1 A. \\v 2 B.";

describe("renderPreviewHtml", () => {
  it("renders escaped HTML for user text", () => {
    const html = renderPreviewHtml("\\id GEN\n\\c 1\n\\p\n\\v 1 <evil>");
    expect(html).toContain("&lt;evil&gt;");
    expect(html).not.toContain("<evil>");
  });

  it("includes marker classes for styled spans", () => {
    const html = renderPreviewHtml("\\id GEN\n\\c 1\n\\p\n\\v 1 \\nd Lord\\nd* here.");
    expect(html).toContain("usfm-nd");
    expect(html).toContain("Lord");
  });

  it("wraps verse numbers in <sup class=\"usfm-v\"> with a data-verse attribute", () => {
    const html = renderPreviewHtml("\\id GEN\n\\c 1\n\\p\n\\v 1 Hi");
    expect(html).toContain('<sup class="usfm-v" data-verse="1">1</sup>');
  });

  it("renders a single <p> for a multi-verse paragraph by default", () => {
    const html = renderPreviewHtml(MULTI_VERSE);
    const matches = html.match(/class="usfm-line usfm-p/g);
    expect(matches?.length).toBe(1);
  });

  it("renders one <p> per verse when versePerLine is true", () => {
    const html = renderPreviewHtml(MULTI_VERSE, { versePerLine: true });
    const matches = html.match(/class="usfm-line usfm-p/g);
    expect(matches?.length).toBe(2);
  });

  it("produces different HTML when versePerLine toggles for a multi-verse paragraph", () => {
    const off = renderPreviewHtml(MULTI_VERSE, { versePerLine: false });
    const on = renderPreviewHtml(MULTI_VERSE, { versePerLine: true });
    expect(on).not.toBe(off);
  });

  it("does not render parse errors for invalid input", () => {
    const html = renderPreviewHtml("\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz bad");
    expect(html.startsWith('<article class="usfm-document"')).toBe(true);
    expect(html).not.toContain("<aside");
  });
});
