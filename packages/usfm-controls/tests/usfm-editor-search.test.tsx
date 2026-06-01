import { describe, it, expect, afterEach, vi } from "vitest";
import { createRef } from "react";
import { cleanup, render, fireEvent, waitFor } from "@testing-library/react";
import {
  UsfmEditor,
  type UsfmEditorHandle,
} from "../src/components/usfm-editor/UsfmEditor.js";

afterEach(() => {
  cleanup();
});

async function renderEditor(
  props: {
    value?: string;
    onChange?: (v: string) => void;
  } = {},
) {
  const ref = createRef<UsfmEditorHandle>();
  const result = render(
    <UsfmEditor ref={ref} value={props.value ?? "\\id GEN\n\\p\n\\v 1 Hello."} onChange={props.onChange} className="h-48" />,
  );
  await waitFor(() => {
    expect(ref.current).toBeTruthy();
    expect(result.container.querySelector(".cm-editor")).toBeTruthy();
  });
  return { ref, ...result };
}

describe("UsfmEditor find and replace", () => {
  it("opens find panel without replace row", async () => {
    const { container, ref } = await renderEditor();
    ref.current!.openFind();
    await waitFor(() => {
      expect(container.querySelector(".usfm-search-panel")).toBeTruthy();
    });
    expect(container.querySelector('input[aria-label="Find"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="Replace"]')).toBeNull();
  });

  it("opens replace row via openFindReplace", async () => {
    const { container, ref } = await renderEditor();
    ref.current!.openFindReplace();
    await waitFor(() => {
      expect(container.querySelector('input[aria-label="Replace"]')).toBeTruthy();
    });
  });

  it("toggles replace visibility from find panel", async () => {
    const { container, ref } = await renderEditor();
    ref.current!.openFind();
    await waitFor(() => {
      expect(container.querySelector(".usfm-search-panel")).toBeTruthy();
    });
    const showReplace = container.querySelector(
      'button[aria-label="Show replace"]',
    ) as HTMLButtonElement;
    fireEvent.click(showReplace);
    await waitFor(() => {
      expect(container.querySelector('input[aria-label="Replace"]')).toBeTruthy();
    });
    const hideReplace = container.querySelector(
      'button[aria-label="Hide replace"]',
    ) as HTMLButtonElement;
    fireEvent.click(hideReplace);
    await waitFor(() => {
      expect(container.querySelector('input[aria-label="Replace"]')).toBeNull();
    });
  });

  it("exposes search mode toggles with icon labels", async () => {
    const { container, ref } = await renderEditor();
    ref.current!.openFind();
    await waitFor(() => {
      expect(container.querySelector('button[aria-label="Match case"]')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Regular expression"]')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Exact match"]')).toBeTruthy();
    });
  });

  it("finds and replaces text", async () => {
    const onChange = vi.fn();
    const { container, ref } = await renderEditor({
      value: "\\id GEN\n\\p\n\\v 1 Hello Hello.",
      onChange,
    });
    ref.current!.openFindReplace();
    const findInput = await waitFor(() => {
      const el = container.querySelector('input[aria-label="Find"]') as HTMLInputElement;
      expect(el).toBeTruthy();
      return el;
    });
    const replaceInput = container.querySelector(
      'input[aria-label="Replace"]',
    ) as HTMLInputElement;
    fireEvent.input(findInput, { target: { value: "Hello" } });
    fireEvent.input(replaceInput, { target: { value: "Hi" } });
    const replaceAll = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "All",
    );
    fireEvent.click(replaceAll!);
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as string;
      expect(last).toContain("Hi");
      expect(last).not.toContain("Hello");
    });
  });
});
