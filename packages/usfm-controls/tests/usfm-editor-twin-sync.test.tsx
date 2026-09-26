import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { useState } from "react";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { render, waitFor } from "./testing-react.ts";
import { UsfmEditor } from "../src/components/usfm-editor/UsfmEditor.js";
import { createLocalLanguageClient } from "../src/language-service/local-client.js";
import {
  createDocumentSessionManager,
  type DocumentSessionManager,
} from "../src/language-service/document-sessions.js";
import type { DocumentChange, UsfmLanguageClient } from "../src/language-service/protocol.js";

const INITIAL = "\\id GEN Genesis\n\\c 1\n\\p\n\\v 1 In the beginning God created.\n\\v 2 The earth was formless.";

/** Two editors sharing one value buffer, like two workspace tabs on one file. */
function TwinEditors() {
  const [value, setValue] = useState(INITIAL);
  return (
    <>
      <div data-testid="ed-a">
        <UsfmEditor value={value} onChange={setValue} onChangeDebounceMs={30} className="h-48" />
      </div>
      <div data-testid="ed-b">
        <UsfmEditor value={value} onChange={setValue} onChangeDebounceMs={30} className="h-48" />
      </div>
    </>
  );
}

/** Two editors sharing one document session, like two tabs on one file. */
function SharedTwinEditors({
  client,
  manager,
}: {
  client: UsfmLanguageClient;
  manager: DocumentSessionManager;
}) {
  const [value, setValue] = useState(INITIAL);
  return (
    <>
      <div data-testid="ed-a">
        <UsfmEditor
          value={value}
          onChange={setValue}
          onChangeDebounceMs={30}
          languageClient={client}
          documentSessions={manager}
          documentKey="file-1"
          className="h-48"
        />
      </div>
      <div data-testid="ed-b">
        <UsfmEditor
          value={value}
          onChange={setValue}
          onChangeDebounceMs={30}
          languageClient={client}
          documentSessions={manager}
          documentKey="file-1"
          className="h-48"
        />
      </div>
    </>
  );
}

function viewIn(container: HTMLElement, testId: string): EditorView {
  const host = container.querySelector(`[data-testid="${testId}"] .cm-editor`);
  if (!(host instanceof HTMLElement)) throw new Error(`no editor under ${testId}`);
  const view = EditorView.findFromDOM(host);
  if (!view) throw new Error(`no view under ${testId}`);
  return view;
}

/** Text content of each marker-highlight span in the given editor. */
function markerSpans(container: HTMLElement, testId: string): string[] {
  return Array.from(
    container.querySelectorAll(`[data-testid="${testId}"] .cm-usfm-marker`),
    (el) => el.textContent ?? "",
  );
}

describe("twin editors sharing one buffer", () => {
  it("forwards external value updates as minimal edits, not full replaces", async () => {
    // A full-document replace ships the whole book over the language-client
    // bridge on every cross-tab echo; the editor must trim the common
    // prefix/suffix and forward only the actual edit.
    const batches: DocumentChange[][] = [];
    const inner = createLocalLanguageClient();
    const client: UsfmLanguageClient = {
      ...inner,
      applyChanges(id, version, changes) {
        batches.push(changes);
        return inner.applyChanges(id, version, changes);
      },
    };

    const { container, rerender } = render(
      <UsfmEditor value={INITIAL} languageClient={client} className="h-48" />,
    );
    await waitFor(() => {
      expect(container.querySelector(".cm-editor")).toBeTruthy();
    });

    const updated = INITIAL.replace("beginning", "very beginning");
    rerender(<UsfmEditor value={updated} languageClient={client} className="h-48" />);

    await waitFor(() => {
      expect(batches.length).toBe(1);
    });
    expect(batches[0]).toHaveLength(1);
    const change = batches[0]![0]!;
    expect(change.text).toBe("very ");
    expect(change.to - change.from).toBe(0);
    expect(change.from).toBe(INITIAL.indexOf("beginning"));
    expect(
      EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!.state.doc.toString(),
    ).toBe(updated);
  });

  it("shares one client document and converges synchronously when sessions are shared", async () => {
    const inner = createLocalLanguageClient();
    const opens: string[] = [];
    const applies: DocumentChange[][] = [];
    const client: UsfmLanguageClient = {
      ...inner,
      openDocument(id, version, text) {
        opens.push(id);
        return inner.openDocument(id, version, text);
      },
      applyChanges(id, version, changes) {
        applies.push(changes);
        return inner.applyChanges(id, version, changes);
      },
    };
    const manager = createDocumentSessionManager(client);
    const { container } = render(<SharedTwinEditors client={client} manager={manager} />);
    await waitFor(() => {
      expect(container.querySelectorAll(".cm-editor").length).toBe(2);
    });
    await waitFor(() => {
      expect(opens.length).toBe(1); // one client document for both views
    });

    // Typing in A appears in B synchronously (no debounce round trip) and
    // reaches the client exactly once, as the minimal edit.
    const a = viewIn(container, "ed-a");
    const b = viewIn(container, "ed-b");
    const insertAt = a.state.doc.toString().indexOf("God");
    a.dispatch({ changes: { from: insertAt, insert: "mighty " } });
    expect(b.state.doc.toString()).toBe(a.state.doc.toString());
    // The client call drains through the session's ordered queue.
    await waitFor(() => {
      expect(applies).toHaveLength(1);
    });
    expect(applies[0]).toEqual([{ from: insertAt, to: insertAt, text: "mighty " }]);

    // A's edit must not enter B's undo history.
    expect(undo(b)).toBe(false);
    expect(b.state.doc.toString()).toBe(a.state.doc.toString());

    // Typing in B flows back to A the same way.
    b.dispatch({ changes: { from: insertAt, insert: "al" } });
    expect(a.state.doc.toString()).toBe(b.state.doc.toString());
    expect(a.state.doc.toString()).toContain("almighty God");
    await waitFor(() => {
      expect(applies).toHaveLength(2);
    });

    // The debounced value echo through the shared parent must not disturb
    // the already-converged buffers.
    await waitFor(() => {
      expect(applies.length).toBe(2); // no further syncs after echo
      expect(a.state.doc.toString()).toBe(b.state.doc.toString());
    });

    // Both editors still highlight markers correctly.
    await waitFor(() => {
      for (const id of ["ed-a", "ed-b"]) {
        const spans = markerSpans(container, id);
        expect(spans.length).toBeGreaterThan(0);
        for (const s of spans) expect(s.startsWith("\\")).toBe(true);
      }
    });
  });

  it("session-managed editors never apply value-prop changes (stale sibling echoes)", async () => {
    // Regression: a delayed value echo of tab A's emission reaching tab B
    // after further typing used to make B "correct" its buffer backward —
    // deleting the newest keystrokes in both tabs via the session.
    const client = createLocalLanguageClient();
    const manager = createDocumentSessionManager(client);
    const { container, rerender } = render(
      <UsfmEditor
        value={INITIAL}
        languageClient={client}
        documentSessions={manager}
        documentKey="file-1"
        className="h-48"
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".cm-editor")).toBeTruthy();
    });
    const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;
    view.dispatch({ changes: { from: view.state.doc.length, insert: " newest" } });
    const live = view.state.doc.toString();

    // A stale echo (the pre-edit text) arrives as the value prop: no revert.
    rerender(
      <UsfmEditor
        value={INITIAL}
        languageClient={client}
        documentSessions={manager}
        documentKey="file-1"
        className="h-48"
      />,
    );
    expect(view.state.doc.toString()).toBe(live);
  });

  it("keeps tab B's syntax highlighting aligned after edits in tab A", async () => {
    const { container } = render(<TwinEditors />);
    await waitFor(() => {
      expect(container.querySelectorAll(".cm-editor").length).toBe(2);
    });

    // Both editors should highlight their markers once the initial classify lands.
    await waitFor(() => {
      expect(markerSpans(container, "ed-a").length).toBeGreaterThan(0);
      expect(markerSpans(container, "ed-b").length).toBeGreaterThan(0);
    });

    // Type into A mid-verse; the debounced echo full-replaces B's document.
    const a = viewIn(container, "ed-a");
    const insertAt = a.state.doc.toString().indexOf("God");
    a.dispatch({ changes: { from: insertAt, insert: "almighty " } });

    await waitFor(() => {
      expect(viewIn(container, "ed-b").state.doc.toString()).toBe(a.state.doc.toString());
    });

    // B's decorations must wrap actual markers, not arbitrary word letters.
    await waitFor(() => {
      const spans = markerSpans(container, "ed-b");
      expect(spans.length).toBeGreaterThan(0);
      for (const s of spans) {
        expect(s.startsWith("\\")).toBe(true);
      }
    });
  });
});
