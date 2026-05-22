import { describe, expect, it } from "vitest";
import { PLACEHOLDER_TEXT } from "./placeholder";

describe("placeholder copy", () => {
  it("documents that the editor is not built yet", () => {
    expect(PLACEHOLDER_TEXT).toMatch(/Bible editor/i);
    expect(PLACEHOLDER_TEXT).toMatch(/Todo/i);
  });
});
