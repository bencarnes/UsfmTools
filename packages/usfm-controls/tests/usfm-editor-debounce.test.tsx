import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { createRef } from "react";
import { EditorView } from "@codemirror/view";
import { render, waitFor } from "./testing-react.ts";
import { UsfmEditor, type UsfmEditorHandle } from "../src/components/usfm-editor/UsfmEditor.js";

function viewFromContainer(container: HTMLElement): EditorView {
  const dom = container.querySelector(".cm-editor");
  if (!(dom instanceof HTMLElement)) throw new Error("Expected CodeMirror editor");
  const view = EditorView.findFromDOM(dom);
  if (!view) throw new Error("Expected EditorView");
  return view;
}

describe("UsfmEditor debounced onChange", () => {
  it("delays onChange until the debounce period elapses", async () => {
    const onChange = spy((_value: string) => {});
    const ref = createRef<UsfmEditorHandle>();
    const { container } = render(
      <UsfmEditor
        ref={ref}
        value={"\\id GEN\n\\p\n\\v 1 Hello."}
        onChange={onChange}
        onChangeDebounceMs={50}
        className="h-48"
      />,
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
      expect(container.querySelector(".cm-editor")).toBeTruthy();
    });

    const view = viewFromContainer(container);
    view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } });

    expect(onChange.calls.length).toBe(0);

    await waitFor(() => {
      expect(onChange.calls.length).toBe(1);
    });
  });

  it("flushChange emits pending edits immediately", async () => {
    const onChange = spy((_value: string) => {});
    const ref = createRef<UsfmEditorHandle>();
    const { container } = render(
      <UsfmEditor
        ref={ref}
        value={"\\id GEN\n\\p\n\\v 1 Hello."}
        onChange={onChange}
        onChangeDebounceMs={5000}
        className="h-48"
      />,
    );

    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    const view = viewFromContainer(container);
    view.dispatch({ changes: { from: view.state.doc.length, insert: "x" } });

    expect(onChange.calls.length).toBe(0);
    ref.current!.flushChange();
    expect(onChange.calls.length).toBe(1);
  });

  it("fires onDirty once before debounced onChange", async () => {
    const onChange = spy((_value: string) => {});
    const onDirty = spy(() => {});
    const { container } = render(
      <UsfmEditor
        value={"\\id GEN\n\\p\n\\v 1 Hello."}
        onChange={onChange}
        onChangeDebounceMs={5000}
        onDirty={onDirty}
        className="h-48"
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-editor")).toBeTruthy();
    });

    const view = viewFromContainer(container);
    view.dispatch({ changes: { from: view.state.doc.length, insert: "?" } });

    expect(onDirty.calls.length).toBe(1);
    expect(onChange.calls.length).toBe(0);
  });
});
