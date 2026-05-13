import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { TokenType } from "../src/types.js";

describe("Lexer", () => {
  describe("basic tokenization", () => {
    it("should tokenize a simple marker", () => {
      const lexer = new Lexer("\\id GEN");
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({
        type: TokenType.Marker,
        value: "id",
        isNested: false,
        isEnd: false,
      });
      expect(tokens[1]).toMatchObject({
        type: TokenType.Text,
        value: " GEN",
      });
    });

    it("should tokenize text between markers", () => {
      const lexer = new Lexer("\\p Some text here");
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({
        type: TokenType.Marker,
        value: "p",
      });
      expect(tokens[1]).toMatchObject({
        type: TokenType.Text,
        value: " Some text here",
      });
    });

    it("should tokenize nested markers with +", () => {
      const lexer = new Lexer("\\+nd Lord\\+nd*");
      const tokens = lexer.tokenize();
      expect(tokens[0]).toMatchObject({
        type: TokenType.Marker,
        value: "nd",
        isNested: true,
        isEnd: false,
      });
      expect(tokens[1]).toMatchObject({
        type: TokenType.Text,
        value: " Lord",
      });
      expect(tokens[2]).toMatchObject({
        type: TokenType.EndMarker,
        value: "nd",
        isNested: true,
        isEnd: true,
      });
    });

    it("should tokenize end markers", () => {
      const lexer = new Lexer("\\bk Genesis\\bk*");
      const tokens = lexer.tokenize();
      expect(tokens[0]).toMatchObject({
        type: TokenType.Marker,
        value: "bk",
        isEnd: false,
      });
      expect(tokens[1]).toMatchObject({
        type: TokenType.Text,
        value: " Genesis",
      });
      expect(tokens[2]).toMatchObject({
        type: TokenType.EndMarker,
        value: "bk",
        isEnd: true,
      });
    });

    it("should tokenize newlines", () => {
      const lexer = new Lexer("\\p Text\n\\v 1 Verse");
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(5);
      expect(tokens[2]).toMatchObject({
        type: TokenType.Newline,
        value: "\n",
      });
    });

    it("should handle \\r\\n line endings", () => {
      const lexer = new Lexer("\\p Text\r\n\\v 1");
      const tokens = lexer.tokenize();
      const newlineToken = tokens.find((t) => t.type === TokenType.Newline);
      expect(newlineToken).toBeDefined();
    });
  });

  describe("escaped characters", () => {
    it("should handle escaped backslash", () => {
      const lexer = new Lexer("\\p text \\\\ more");
      const tokens = lexer.tokenize();
      const textTokens = tokens.filter((t) => t.type === TokenType.Text);
      const combined = textTokens.map((t) => t.value).join("");
      expect(combined).toContain("\\");
    });

    it("should handle escaped pipe", () => {
      const lexer = new Lexer("\\p text \\| more");
      const tokens = lexer.tokenize();
      const textTokens = tokens.filter((t) => t.type === TokenType.Text);
      const combined = textTokens.map((t) => t.value).join("");
      expect(combined).toContain("|");
    });
  });

  describe("attributes", () => {
    it("should tokenize key=value attributes", () => {
      const lexer = new Lexer('\\w grace|lemma="grace" strong="G5485"\\w*');
      const tokens = lexer.tokenize();
      const attrToken = tokens.find((t) => t.type === TokenType.Attribute);
      expect(attrToken).toBeDefined();
      expect(attrToken!.attributes).toEqual({
        lemma: "grace",
        strong: "G5485",
      });
    });

    it("should tokenize default attribute text", () => {
      const lexer = new Lexer("\\w grace|grace\\w*");
      const tokens = lexer.tokenize();
      const attrToken = tokens.find((t) => t.type === TokenType.Attribute);
      expect(attrToken).toBeDefined();
      expect(attrToken!.value).toBe("grace");
    });
  });

  describe("optional break", () => {
    it("should tokenize // as optbreak", () => {
      const lexer = new Lexer("\\p text // more text");
      const tokens = lexer.tokenize();
      const optBreak = tokens.find((t) => t.type === TokenType.OptBreak);
      expect(optBreak).toBeDefined();
      expect(optBreak!.value).toBe("//");
    });

    it("should not treat single / as optbreak", () => {
      const lexer = new Lexer("\\p text / more text");
      const tokens = lexer.tokenize();
      const optBreak = tokens.find((t) => t.type === TokenType.OptBreak);
      expect(optBreak).toBeUndefined();
    });
  });

  describe("position tracking", () => {
    it("should track line and column positions", () => {
      const lexer = new Lexer("\\id GEN\n\\c 1");
      const tokens = lexer.tokenize();
      expect(tokens[0].position).toEqual({
        line: 0,
        column: 0,
        offset: 0,
      });
      // After newline
      const cToken = tokens.find(
        (t) => t.type === TokenType.Marker && t.value === "c"
      );
      expect(cToken).toBeDefined();
      expect(cToken!.position.line).toBe(1);
    });
  });

  describe("complex sequences", () => {
    it("should tokenize a full verse with footnote", () => {
      const input =
        '\\v 1 In the beginning\\f + \\fr 1:1 \\ft Some note\\f* God created';
      const lexer = new Lexer(input);
      const tokens = lexer.tokenize();

      const markers = tokens
        .filter(
          (t) => t.type === TokenType.Marker || t.type === TokenType.EndMarker
        )
        .map((t) => (t.isEnd ? t.value + "*" : t.value));

      expect(markers).toContain("v");
      expect(markers).toContain("f");
      expect(markers).toContain("fr");
      expect(markers).toContain("ft");
      expect(markers).toContain("f*");
    });

    it("should handle consecutive markers without text", () => {
      const lexer = new Lexer("\\c 1\n\\s Section Title\n\\p\n\\v 1 Text");
      const tokens = lexer.tokenize();
      const markers = tokens
        .filter((t) => t.type === TokenType.Marker)
        .map((t) => t.value);
      expect(markers).toEqual(["c", "s", "p", "v"]);
    });
  });
});
