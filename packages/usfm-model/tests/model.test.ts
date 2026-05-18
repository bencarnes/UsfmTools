import { describe, it, expect } from "vitest";
import { parse } from "../src/index.js";

describe("usfm-model", () => {
  it("should re-export parse from @usfm-tools/parser", () => {
    const result = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning.");
    expect(result.document.type).toBe("document");
    expect(result.errors).toHaveLength(0);
  });
});
