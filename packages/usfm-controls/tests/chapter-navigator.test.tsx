import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { parse } from "@usfm-tools/parser";
import { ChapterNavigator } from "../src/components/usfm-pane/chapter-navigator.js";

afterEach(() => {
  cleanup();
});

const book = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 Hello.\n\\c 2\n\\p\n\\v 1 More.").document
  .children[0] as import("@usfm-tools/parser").BookNode;

describe("ChapterNavigator", () => {
  it("shows prev/next tooltips and a chapter dropdown without a Chapters label", () => {
    render(
      <ChapterNavigator
        navChapterText="1"
        hasChapters
        atLastChapter={false}
        firstBook={book}
        buttonStyle={{}}
        onPrevChapter={() => {}}
        onNextChapter={() => {}}
        onChapterPicked={() => {}}
      />,
    );
    expect(screen.getByLabelText("Previous chapter").getAttribute("title")).toBe("Previous chapter");
    expect(screen.getByLabelText("Next chapter").getAttribute("title")).toBe("Next chapter");
    expect(screen.queryByText(/Chapters/)).toBeNull();
    expect(screen.getByLabelText("Chapter 1, select chapter")).toBeTruthy();
  });

  it("closes the menu and calls onChapterPicked when a chapter is chosen", () => {
    const onChapterPicked = vi.fn();
    render(
      <ChapterNavigator
        navChapterText="1"
        hasChapters
        atLastChapter={false}
        firstBook={book}
        buttonStyle={{}}
        onPrevChapter={() => {}}
        onNextChapter={() => {}}
        onChapterPicked={onChapterPicked}
      />,
    );
    fireEvent.click(screen.getByLabelText("Chapter 1, select chapter"));
    fireEvent.click(screen.getByRole("button", { name: /Open chapter 2/ }));
    expect(onChapterPicked).toHaveBeenCalledWith({ chapterNumber: "2" });
  });
});
