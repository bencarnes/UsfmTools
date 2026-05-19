import { describe, it, expect } from "vitest";
import { parse } from "../src/index.js";
import {
  UsfmRenderer,
  defaultPublicationTemplate,
  mergePublicationTemplate,
} from "../src/index.js";

describe("UsfmRenderer", () => {
  it("renders escaped HTML for user text", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 <evil>");
    const html = new UsfmRenderer(defaultPublicationTemplate()).renderDocument(document);
    expect(html).toContain("&lt;evil&gt;");
    expect(html).not.toContain("<evil>");
  });

  it("applies template overrides", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Hi");
    const base = defaultPublicationTemplate();
    const html = new UsfmRenderer(
      mergePublicationTemplate(base, {
        verseNumber: (n) => `<b class="v">${base.escapeText(n)}</b>`,
      }),
    ).renderDocument(document);
    expect(html).toContain('<b class="v">1</b>');
    expect(html).not.toContain("<sup");
  });

  it("includes marker classes for styled spans", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 \\nd Lord\\nd* here.");
    const html = new UsfmRenderer(defaultPublicationTemplate()).renderDocument(document);
    expect(html).toContain("usfm-nd");
    expect(html).toContain("Lord");
  });

  it("renders one paragraph element per verse when versePerLine is true", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 A. \\v 2 B.");
    const html = new UsfmRenderer(defaultPublicationTemplate()).renderDocument(document, {
      versePerLine: true,
    });
    const matches = html.match(/class="usfm-line usfm-p/g);
    expect(matches?.length).toBe(2);
  });
});
