import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { EditorView } from "@codemirror/view";
import { render, waitFor } from "./testing-react.ts";
import { UsfmEditor } from "../src/components/usfm-editor/UsfmEditor.js";
import {
  DiagnosticSeverity,
  type AnalysisEvent,
  type Diagnostic,
  type UsfmLanguageClient,
} from "../src/language-service/protocol.js";

function viewFromContainer(container: HTMLElement): EditorView {
  const dom = container.querySelector(".cm-editor");
  if (!(dom instanceof HTMLElement)) throw new Error("Expected CodeMirror editor");
  const view = EditorView.findFromDOM(dom);
  if (!view) throw new Error("Expected EditorView");
  return view;
}

/** Client stub that records lifecycle calls and lets the test push analyses. */
function analysisPushClient() {
  const opens: { id: string; version: number }[] = [];
  const listeners = new Set<(event: AnalysisEvent) => void>();
  const client: UsfmLanguageClient = {
    openDocument(id, version, _text) {
      opens.push({ id, version });
      return Promise.resolve();
    },
    applyChanges: () => Promise.resolve(),
    closeDocument: () => Promise.resolve(),
    getDiagnostics: () => Promise.resolve({ version: 0, diagnostics: [] }),
    getStructure: () => Promise.resolve({ version: 0, books: [] }),
    classifyDocument: () => Promise.resolve({ version: 0, tokens: [] }),
    classifyRange: () => Promise.resolve({ version: 0, tokens: [] }),
    getCompletions: () => Promise.resolve([]),
    renderPreviewDocument: () => Promise.resolve({ version: 0, html: "" }),
    renderPreview: () => Promise.resolve(""),
    onAnalysis(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const push = (event: AnalysisEvent) => {
    for (const l of [...listeners]) l(event);
  };
  return { client, opens, push };
}

function someDiagnostic(): Diagnostic {
  return {
    range: {
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 3, offset: 3 },
    },
    message: "problem",
    severity: DiagnosticSeverity.Error,
  };
}

describe("UsfmEditor analysis pushes", () => {
  it("applies pushes at the forwarded version and skips stale ones", async () => {
    const { client, opens, push } = analysisPushClient();
    const onDiagnostics = spy((_d: readonly Diagnostic[]) => {});
    const { container } = render(
      <UsfmEditor
        value={"\\id GEN\n\\p\n\\v 1 Hello."}
        languageClient={client}
        onDiagnostics={onDiagnostics}
        className="h-48"
      />,
    );

    await waitFor(() => {
      expect(opens.length).toBe(1);
      expect(container.querySelector(".cm-editor")).toBeTruthy();
    });
    const documentId = opens[0]!.id;
    expect(opens[0]!.version).toBe(1);

    // Push for a different document: ignored.
    push({ id: "someone-else", version: 99, diagnostics: [someDiagnostic()] });
    expect(onDiagnostics.calls.length).toBe(0);

    // Fresh push at the open version: applied.
    push({ id: documentId, version: 1, diagnostics: [someDiagnostic()] });
    expect(onDiagnostics.calls.length).toBe(1);
    expect(onDiagnostics.calls[0]!.args[0]).toHaveLength(1);

    // An edit forwards version 2; a late analysis of version 1 is stale and
    // must be skipped (its positions predate the edit).
    const view = viewFromContainer(container);
    view.dispatch({ changes: { from: 0, insert: "x" } });
    push({ id: documentId, version: 1, diagnostics: [] });
    expect(onDiagnostics.calls.length).toBe(1);

    // The follow-up analysis at the forwarded version is applied.
    push({ id: documentId, version: 2, diagnostics: [] });
    expect(onDiagnostics.calls.length).toBe(2);
    expect(onDiagnostics.calls[1]!.args[0]).toHaveLength(0);
  });
});
