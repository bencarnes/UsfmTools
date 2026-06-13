import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { render, screen, fireEvent } from "./testing-react.ts";
import { ChapterPicker } from "../src/components/chapter-picker/ChapterPicker.js";

describe("ChapterPicker", () => {
  it("renders chapter labels in USFM order", () => {
    render(<ChapterPicker chapterNumbers={["10", "2"]} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b: HTMLElement) => b.textContent)).toEqual(["10", "2"]);
  });

  it("fires onChapterSelect with the exact chapter number string", () => {
    const onChapterSelect = spy((_selection: { chapterNumber: string }) => {});
    render(<ChapterPicker chapterNumbers={["١"]} onChapterSelect={onChapterSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Open chapter ١/ }));
    expect(onChapterSelect.calls[0]?.args).toEqual([{ chapterNumber: "١" }]);
  });

  it("renders no buttons when the book has no chapters", () => {
    render(<ChapterPicker chapterNumbers={[]} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
