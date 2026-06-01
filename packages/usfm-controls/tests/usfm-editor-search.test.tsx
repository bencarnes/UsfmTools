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

  it("toggles replace section with the left chevron", async () => {
    const { container, ref } = await renderEditor();
    ref.current!.openFind();
    await waitFor(() => {
      expect(container.querySelector(".usfm-search-panel")).toBeTruthy();
    });
    const toggle = container.querySelector(
      'button[title="Toggle Replace"]',
    ) as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(container.querySelector('input[aria-label="Replace"]')).toBeTruthy();
    });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(container.querySelector('input[aria-label="Replace"]')).toBeNull();
    });
  });

  it("exposes VS Code-style search mode toggles with tooltips", async () => {
    const { container, ref } = await renderEditor();
    ref.current!.openFind();
    await waitFor(() => {
      expect(container.querySelector('button[title="Match Case"]')).toBeTruthy();
      expect(container.querySelector('button[title="Match Whole Word"]')).toBeTruthy();
      expect(container.querySelector('button[title="Use Regular Expression"]')).toBeTruthy();
    });
  });

  it("replaces all matches", async () => {
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
    const replaceAll = container.querySelector('button[title="Replace All"]') as HTMLButtonElement;
    fireEvent.click(replaceAll);
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as string;
      expect(last).toContain("Hi");
      expect(last).not.toContain("Hello");
    });
  });

  it("replace does not wrap to earlier occurrences", async () => {
    const onChange = vi.fn();
    const { container, ref } = await renderEditor({
      value: "\\id GEN\n\\p\n\\v 1 first second first end.",
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
    fireEvent.input(findInput, { target: { value: "first" } });
    fireEvent.input(replaceInput, { target: { value: "1st" } });

    const replaceBtn = container.querySelector('button[title="Replace"]') as HTMLButtonElement;
    fireEvent.click(replaceBtn);
    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/1st second first/);
    });
    fireEvent.click(replaceBtn);
    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/1st second 1st end/);
    });
  });

  it("replace advances to the next occurrence after replacing", async () => {
    const onChange = vi.fn();
    const { container, ref } = await renderEditor({
      value: "\\id GEN\n\\p\n\\v 1 aa bb aa.",
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
    fireEvent.input(findInput, { target: { value: "aa" } });
    fireEvent.input(replaceInput, { target: { value: "XX" } });

    const replaceBtn = container.querySelector('button[title="Replace"]') as HTMLButtonElement;
    fireEvent.click(replaceBtn);
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as string;
      expect(last).toMatch(/XX bb aa/);
    });

    fireEvent.click(replaceBtn);
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as string;
      expect(last).toMatch(/XX bb XX/);
    });
  });
});
