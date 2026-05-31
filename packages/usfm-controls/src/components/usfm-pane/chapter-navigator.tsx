import { useRef, type CSSProperties } from "react";
import type { BookNode } from "@usfm-tools/parser";
import { ChapterPicker } from "../chapter-picker/ChapterPicker.js";
import type { ChapterPickerSelectDetail } from "../chapter-picker/ChapterPicker.js";

const mono: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export interface ChapterNavigatorProps {
  readonly navChapterText: string;
  readonly hasChapters: boolean;
  readonly atLastChapter: boolean;
  readonly firstBook: BookNode | undefined;
  readonly buttonStyle: CSSProperties;
  readonly onPrevChapter: () => void;
  readonly onNextChapter: () => void;
  readonly onChapterPicked: (detail: ChapterPickerSelectDetail) => void;
}


function IconChapterChevronDown() {
  return (
    <svg
      width={16}
      height={10}
      viewBox="0 0 16 10"
      aria-hidden
      className="block"
      style={{ flexShrink: 0, opacity: 0.85 }}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 2.5 8 8 14 2.5"
      />
    </svg>
  );
}

export function ChapterNavigator({
  navChapterText,
  hasChapters,
  atLastChapter,
  firstBook,
  buttonStyle,
  onPrevChapter,
  onNextChapter,
  onChapterPicked,
}: ChapterNavigatorProps) {
  const chapterMenuRef = useRef<HTMLDetailsElement>(null);

  const navBtn: CSSProperties = {
    ...buttonStyle,
    padding: "0.15rem 0.35rem",
    fontSize: "0.8rem",
    lineHeight: 1.1,
    minWidth: "1.5rem",
  };

  const onPicked = (detail: ChapterPickerSelectDetail) => {
    chapterMenuRef.current?.removeAttribute("open");
    onChapterPicked(detail);
  };

  const chapterLabel = hasChapters ? `Chapter ${navChapterText}, select chapter` : "No chapters";

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}
      aria-label="Chapter"
    >
      <button
        type="button"
        aria-label="Previous chapter"
        title="Previous chapter"
        disabled={!hasChapters}
        style={{ ...navBtn, opacity: hasChapters ? 1 : 0.45 }}
        onClick={onPrevChapter}
      >
        ◀
      </button>

      <details ref={chapterMenuRef} style={{ position: "relative" }}>
        <summary
          style={{
            ...navBtn,
            ...mono,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.15rem",
            minWidth: "2.25rem",
            listStyle: "none",
            cursor: hasChapters ? "pointer" : "not-allowed",
            opacity: hasChapters ? 1 : 0.45,
          }}
          aria-label={chapterLabel}
          title={hasChapters ? "Select chapter" : undefined}
          onClick={(ev) => {
            if (!hasChapters) ev.preventDefault();
          }}
        >
          <span aria-live="polite">{navChapterText}</span>
          {hasChapters ? <IconChapterChevronDown /> : null}
        </summary>
        <div
          style={{
            position: "absolute",
            left: 0,
            zIndex: 20,
            marginTop: "0.2rem",
            padding: "0.4rem",
            maxHeight: "14rem",
            overflow: "auto",
            minWidth: "12rem",
            background: "Canvas",
            border: "1px solid color-mix(in srgb, CanvasText 22%, transparent)",
            borderRadius: "6px",
            boxShadow: "0 4px 12px color-mix(in srgb, CanvasText 12%, transparent)",
          }}
        >
          {firstBook ? (
            <ChapterPicker book={firstBook} onChapterSelect={onPicked} />
          ) : (
            <span style={{ fontSize: "0.85rem", color: "#666" }}>No \\id book in source.</span>
          )}
        </div>
      </details>

      <button
        type="button"
        aria-label="Next chapter"
        title="Next chapter"
        disabled={!hasChapters || atLastChapter}
        style={{
          ...navBtn,
          opacity: hasChapters && !atLastChapter ? 1 : 0.45,
        }}
        onClick={onNextChapter}
      >
        ▶
      </button>
    </div>
  );
}
