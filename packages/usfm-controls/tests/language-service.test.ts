import { describe, it, expect } from "vitest";
import {
  UsfmLanguageService,
  createLanguageClient,
  DiagnosticSeverity,
  TokenType,
} from "../src/language-service/index.js";

describe("UsfmLanguageService", () => {
  const service = new UsfmLanguageService();

  describe("validate", () => {
    it("should return no diagnostics for valid USFM", () => {
      const response = service.handleMessage({
        type: "validate",
        id: "1",
        content: "\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning.",
      });
      expect(response.type).toBe("validate");
      if (response.type === "validate") {
        expect(response.diagnostics).toHaveLength(0);
      }
    });

    it("should return diagnostics for unknown markers", () => {
      const response = service.handleMessage({
        type: "validate",
        id: "2",
        content: "\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz bad.",
      });
      if (response.type === "validate") {
        expect(response.diagnostics.length).toBeGreaterThan(0);
        expect(response.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
        expect(response.diagnostics[0].message).toContain("Unknown marker");
      }
    });

    it("should include position information in diagnostics", () => {
      const response = service.handleMessage({
        type: "validate",
        id: "3",
        content: "\\id GEN\n\\v 1 \\zzz text",
      });
      if (response.type === "validate") {
        expect(response.diagnostics.length).toBeGreaterThan(0);
        const diag = response.diagnostics[0];
        expect(diag.range.start.line).toBeGreaterThanOrEqual(0);
        expect(diag.range.start.column).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("complete", () => {
    it("should return completions when cursor is after backslash", () => {
      const response = service.handleMessage({
        type: "complete",
        id: "4",
        content: "\\id GEN\n\\c 1\n\\",
        position: { line: 2, column: 1 },
      });
      if (response.type === "complete") {
        expect(response.items.length).toBeGreaterThan(0);
      }
    });

    it("should filter completions by partial input", () => {
      const response = service.handleMessage({
        type: "complete",
        id: "5",
        content: "\\id GEN\n\\q",
        position: { line: 1, column: 2 },
      });
      if (response.type === "complete") {
        expect(response.items.length).toBeGreaterThan(0);
        for (const item of response.items) {
          expect(item.label).toMatch(/^\\q/);
        }
      }
    });

    it("should return empty completions when not at a marker position", () => {
      const response = service.handleMessage({
        type: "complete",
        id: "6",
        content: "\\id GEN\nsome text",
        position: { line: 1, column: 5 },
      });
      if (response.type === "complete") {
        expect(response.items).toHaveLength(0);
      }
    });
  });

  describe("classify", () => {
    it("should classify markers", () => {
      const response = service.handleMessage({
        type: "classify",
        id: "7",
        content: "\\id GEN\n\\c 1\n\\p\n\\v 1 Text",
      });
      if (response.type === "classify") {
        const markers = response.tokens.filter(
          (t) => t.type === TokenType.Marker
        );
        expect(markers.length).toBeGreaterThan(0);
      }
    });

    it("should classify verse numbers", () => {
      const response = service.handleMessage({
        type: "classify",
        id: "8",
        content: "\\p\n\\v 1 Text\n\\v 2 More",
      });
      if (response.type === "classify") {
        const verseNums = response.tokens.filter(
          (t) => t.type === TokenType.VerseNumber
        );
        expect(verseNums).toHaveLength(2);
      }
    });

    it("should classify chapter numbers", () => {
      const response = service.handleMessage({
        type: "classify",
        id: "9",
        content: "\\c 1\n\\c 2",
      });
      if (response.type === "classify") {
        const chapterNums = response.tokens.filter(
          (t) => t.type === TokenType.ChapterNumber
        );
        expect(chapterNums).toHaveLength(2);
      }
    });
  });
});

describe("createLanguageClient", () => {
  it("should provide an async API", async () => {
    const client = createLanguageClient();

    const diagnostics = await client.validate("\\id GEN\n\\c 1\n\\p\n\\v 1 Text");
    expect(diagnostics).toHaveLength(0);

    const completions = await client.complete("\\id GEN\n\\q", 1, 2);
    expect(completions.length).toBeGreaterThan(0);

    const tokens = await client.classify("\\v 1 Text");
    expect(tokens.length).toBeGreaterThan(0);
  });
});
