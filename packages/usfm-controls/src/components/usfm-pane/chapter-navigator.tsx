import { useRef, type CSSProperties } from "react";
import { ChapterPicker } from "../chapter-picker/ChapterPicker.js";
import type { ChapterPickerSelectDetail } from "../chapter-picker/ChapterPicker.js";
import { ChevronDownIcon } from "../icons/chevron-down-icon.js";
import { themedPopoverSurface } from "../../theme-tokens.js";

const mono: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export interface ChapterNavigatorProps {
  readonly navChapterText: string;
  readonly hasChapters: boolean;
  readonly atLastChapter: boolean;
  readonly hasBookId: boolean;
  readonly chapterNumbers: readonly string[];
  readonly buttonStyle: CSSProperties;
  readonly onPrevChapter: () => void;
  readonly onNextChapter: () => void;
  readonly onChapterPicked: (detail: ChapterPickerSelectDetail) => void;
}

export function ChapterNavigator({
  navChapterText,
  hasChapters,
  atLastChapter,
  hasBookId,
  chapterNumbers,
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
          {hasChapters ? <ChevronDownIcon /> : null}
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
            borderRadius: "6px",
            ...themedPopoverSurface,
          }}
        >
          {hasBookId ? (
            <ChapterPicker chapterNumbers={chapterNumbers} onChapterSelect={onPicked} />
          ) : (
            <span style={{ fontSize: "0.85rem", color: "var(--usfm-fg-muted)" }}>No \\id book in source.</span>
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
