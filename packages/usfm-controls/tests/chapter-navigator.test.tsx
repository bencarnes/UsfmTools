import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { cleanup, render, screen, fireEvent } from "./testing-react.ts";
import { parse } from "@usfm-tools/parser";
import { ChapterNavigator } from "../src/components/usfm-pane/chapter-navigator.js";


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
    const onChapterPicked = spy((_selection: { chapterNumber: string }) => {});
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
    expect(onChapterPicked.calls[0]?.args).toEqual([{ chapterNumber: "2" }]);
  });
});
