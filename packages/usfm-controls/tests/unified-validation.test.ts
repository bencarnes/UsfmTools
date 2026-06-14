import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { EditorState } from "@codemirror/state";
import { languageDiagnosticsToCm } from "../src/components/usfm-editor/codemirror-usfm.js";
import { DiagnosticSeverity } from "../src/language-service/index.js";

describe("unified validation", () => {
  it("maps language-service diagnostics to CodeMirror offsets", () => {
    const state = EditorState.create({ doc: "\\id GEN\n\\c 1\n\\xyz bad" });
    const cmDiags = languageDiagnosticsToCm(state.doc, [
      {
        range: {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 4 },
        },
        message: "Unknown marker",
        severity: DiagnosticSeverity.Error,
      },
    ]);
    expect(cmDiags).toHaveLength(1);
    expect(cmDiags[0].from).toBeGreaterThan(0);
    expect(cmDiags[0].message).toContain("Unknown marker");
    expect(cmDiags[0].severity).toBe("error");
  });
});
