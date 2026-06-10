import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { cleanup, render, screen, fireEvent } from "./testing-react.ts";
import type { BookNode } from "@usfm-tools/parser";
import { parse } from "@usfm-tools/parser";
import { ChapterPicker } from "../src/components/chapter-picker/ChapterPicker.js";


function firstBook(usfm: string): BookNode {
  const { document } = parse(usfm);
  const book = document.children.find((c) => c.type === "book") as BookNode | undefined;
  if (!book) {
    throw new Error("Expected book");
  }
  return book;
}

describe("ChapterPicker", () => {
  it("renders chapter labels in USFM order", () => {
    const book = firstBook("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
    render(<ChapterPicker book={book} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["10", "2"]);
  });

  it("fires onChapterSelect with the exact chapter number string", () => {
    const onChapterSelect = spy((_selection: { chapterNumber: string }) => {});
    const book = firstBook("\\id GEN\n\\c ١\n\\p\n\\v 1");
    render(<ChapterPicker book={book} onChapterSelect={onChapterSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Open chapter ١/ }));
    expect(onChapterSelect.calls[0]?.args).toEqual([{ chapterNumber: "١" }]);
  });

  it("renders no buttons when the book has no chapters", () => {
    const book = firstBook("\\id FRT\n\\p\n\\v 1 Only.");
    render(<ChapterPicker book={book} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
