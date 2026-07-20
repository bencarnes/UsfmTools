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

  it("a clean flush emits nothing and does not block later external updates", async () => {
    // Regression: flushing an unchanged document (as the pane does whenever a
    // tab is deactivated) used to emit a no-op change, arming the echo guard
    // with an echo that never arrives — after which edits from another tab
    // sharing the same file buffer were silently dropped.
    const initial = "\\id GEN\n\\p\n\\v 1 Hello.";
    const onChange = spy((_value: string) => {});
    const ref = createRef<UsfmEditorHandle>();
    const { container, rerender } = render(
      <UsfmEditor
        ref={ref}
        value={initial}
        onChange={onChange}
        onChangeDebounceMs={5000}
        className="h-48"
      />,
    );
    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    expect(ref.current!.flushChange()).toBe(initial);
    expect(onChange.calls.length).toBe(0);

    // An edit made in another tab arrives as a new value prop: must apply.
    const fromOtherTab = "\\id GEN\n\\p\n\\v 1 Hello there.";
    rerender(
      <UsfmEditor
        ref={ref}
        value={fromOtherTab}
        onChange={onChange}
        onChangeDebounceMs={5000}
        className="h-48"
      />,
    );
    expect(viewFromContainer(container).state.doc.toString()).toBe(fromOtherTab);
  });

  it("ignores stale value echoes and applies genuine external changes", async () => {
    const initial = "\\id GEN\n\\p\n\\v 1 Hello.";
    const onChange = spy((_value: string) => {});
    const ref = createRef<UsfmEditorHandle>();
    const { container, rerender } = render(
      <UsfmEditor
        ref={ref}
        value={initial}
        onChange={onChange}
        onChangeDebounceMs={5000}
        className="h-48"
      />,
    );
    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });
    const view = viewFromContainer(container);

    // Two emissions in a row (as when a debounce timer fires while an earlier
    // echo is still round-tripping through the parent's state).
    view.dispatch({ changes: { from: view.state.doc.length, insert: "A" } });
    const first = ref.current!.flushChange();
    view.dispatch({ changes: { from: view.state.doc.length, insert: "B" } });
    const second = ref.current!.flushChange();
    expect(second).toBe(`${initial}AB`);

    // The stale echo of the first emission arrives late: it must NOT replace
    // the document (that would wipe "B" and reset the caret to offset 0).
    rerender(
      <UsfmEditor ref={ref} value={first} onChange={onChange} onChangeDebounceMs={5000} className="h-48" />,
    );
    expect(viewFromContainer(container).state.doc.toString()).toBe(second);

    // The fresh echo clears the pending flag...
    rerender(
      <UsfmEditor ref={ref} value={second} onChange={onChange} onChangeDebounceMs={5000} className="h-48" />,
    );
    expect(viewFromContainer(container).state.doc.toString()).toBe(second);

    // ...after which a genuinely external value still applies.
    const external = "\\id EXO\n\\p\n\\v 1 Other.";
    rerender(
      <UsfmEditor ref={ref} value={external} onChange={onChange} onChangeDebounceMs={5000} className="h-48" />,
    );
    expect(viewFromContainer(container).state.doc.toString()).toBe(external);
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
