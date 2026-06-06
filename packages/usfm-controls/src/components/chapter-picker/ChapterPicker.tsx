import { useMemo, type CSSProperties } from "react";
import { themedControlButton } from "../../theme-tokens.js";
import type { BookNode } from "@usfm-tools/parser";
import { listChapterNumbersFromBook } from "@usfm-tools/model";

export interface ChapterPickerSelectDetail {
  /** Chapter number string exactly as on the corresponding `\\c` marker in USFM. */
  readonly chapterNumber: string;
}

export interface ChapterPickerProps {
  /** Parsed USFM book node (`\\id` …); chapter markers are read from its children. */
  readonly book: BookNode;
  readonly onChapterSelect?: (detail: ChapterPickerSelectDetail) => void;
  readonly className?: string;
}

const wrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
  width: "100%",
  boxSizing: "border-box",
};

const monoLabel: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "0.95rem",
  letterSpacing: "0.02em",
};

/** Fixed width sized for three monospace digit cells plus horizontal padding (see UsfmBookPicker). */
const chapterButtonWidth = "calc(3ch + 1.25rem)";

const chapterButtonBase: CSSProperties = {
  ...monoLabel,
  ...themedControlButton,
  boxSizing: "border-box",
  width: chapterButtonWidth,
  minWidth: chapterButtonWidth,
  maxWidth: chapterButtonWidth,
  flex: "0 0 auto",
  minHeight: "2rem",
  padding: "0.25rem 0.35rem",
  cursor: "pointer",
  borderRadius: "4px",
  textAlign: "center",
};

function chapterButtonAriaLabel(chapterNumber: string): string {
  return `Open chapter ${chapterNumber}`;
}

/**
 * Responsive grid of equal-width chapter buttons for one parsed USFM book.
 * Chapter labels are shown **verbatim** and in **document order** (no sorting,
 * deduplication, or numeric interpretation).
 */
export function ChapterPicker({ book, onChapterSelect, className }: ChapterPickerProps) {
  const chapters = useMemo(() => listChapterNumbersFromBook(book), [book]);

  return (
    <div
      className={`chapter-picker-root ${className ?? ""}`.trim()}
      style={wrapStyle}
      role="group"
      aria-label="Chapters"
    >
      {chapters.map((chapterNumber, index) => (
        <button
          key={`${index}:${chapterNumber}`}
          type="button"
          style={chapterButtonBase}
          aria-label={chapterButtonAriaLabel(chapterNumber)}
          onClick={() => onChapterSelect?.({ chapterNumber })}
        >
          {chapterNumber}
        </button>
      ))}
    </div>
  );
}
