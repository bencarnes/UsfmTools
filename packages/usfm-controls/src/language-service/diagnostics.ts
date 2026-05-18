import { parse } from "@usfm-tools/parser";
import type { Diagnostic } from "./protocol.js";
import { DiagnosticSeverity } from "./protocol.js";

export function getDiagnostics(content: string): Diagnostic[] {
  const result = parse(content);
  return result.errors.map((error) => {
    const line = error.position?.line ?? 0;
    const col = error.position?.column ?? 0;

    const lines = content.split("\n");
    const lineText = lines[line] ?? "";
    const endCol = Math.min(col + 10, lineText.length);

    return {
      range: {
        start: { line, column: col },
        end: { line, column: endCol },
      },
      message: error.message,
      severity: DiagnosticSeverity.Error,
    };
  });
}
