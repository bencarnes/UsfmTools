import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { useState } from "react";
import { EditorView } from "@codemirror/view";
import { render, waitFor } from "./testing-react.ts";
import { UsfmEditor } from "../src/components/usfm-editor/UsfmEditor.js";
import { createLocalLanguageClient } from "../src/language-service/local-client.js";
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
