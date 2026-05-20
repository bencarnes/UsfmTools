import { useMemo, type CSSProperties } from "react";
import {
  buildUsfmBookPickerGroups,
  type UsfmBookPickerBook,
  type UsfmBookPickerFileInput,
} from "@usfm-tools/model";

export interface UsfmBookPickerSelectDetail {
  readonly fileId: string;
  readonly code: string;
}

export interface UsfmBookPickerProps {
  /** One USFM book per entry; filesystem paths are not read here. */
  readonly files: readonly UsfmBookPickerFileInput[];
  /** Fired when the user activates a book (click or keyboard on the button). */
  readonly onBookSelect?: (detail: UsfmBookPickerSelectDetail) => void;
  readonly className?: string;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(calc(3ch + 1.25rem), 1fr))",
  gap: "0.35rem",
  width: "100%",
};

const monoLabel: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "0.95rem",
  letterSpacing: "0.02em",
};

const dividerStyle: CSSProperties = {
  border: 0,
  borderTop: "1px solid color-mix(in srgb, CanvasText 18%, transparent)",
  margin: "0.65rem 0",
};

const bookButtonBase: CSSProperties = {
  ...monoLabel,
  width: "100%",
  minHeight: "2rem",
  padding: "0.25rem 0.35rem",
  boxSizing: "border-box",
  cursor: "pointer",
  borderRadius: "4px",
  border: "1px solid color-mix(in srgb, CanvasText 22%, transparent)",
  background: "color-mix(in srgb, Canvas 96%, CanvasText 4%)",
};

function BookGrid({
  books,
  onBookSelect,
}: {
  readonly books: readonly UsfmBookPickerBook[];
  readonly onBookSelect?: (detail: UsfmBookPickerSelectDetail) => void;
}) {
  return (
    <div style={gridStyle}>
      {books.map((book) => (
        <button
          key={book.fileId}
          type="button"
          style={bookButtonBase}
          title={book.code}
          aria-label={`Open ${book.displayLabel} (${book.code})`}
          onClick={() => onBookSelect?.({ fileId: book.fileId, code: book.code })}
        >
          {book.displayLabel}
        </button>
      ))}
    </div>
  );
}

function OtherList({
  books,
  onBookSelect,
}: {
  readonly books: readonly UsfmBookPickerBook[];
  readonly onBookSelect?: (detail: UsfmBookPickerSelectDetail) => void;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        width: "100%",
      }}
    >
      {books.map((book) => (
        <li key={book.fileId} style={{ width: "100%" }}>
          <button
            type="button"
            style={{
              ...bookButtonBase,
              width: "100%",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: "0.95rem",
            }}
            title={book.code}
            aria-label={`Open ${book.displayLabel} (${book.code})`}
            onClick={() => onBookSelect?.({ fileId: book.fileId, code: book.code })}
          >
            {book.displayLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Picker for USFM books: reads `\id` and table-of-contents markers from supplied
 * file contents (no filesystem access), groups Old Testament / New Testament / other
 * standard identifiers, and notifies via `onBookSelect`.
 */
export function UsfmBookPicker({ files, onBookSelect, className }: UsfmBookPickerProps) {
  const groups = useMemo(() => buildUsfmBookPickerGroups(files), [files]);

  const showOther = groups.other.length > 0;

  return (
    <div
      className={`usfm-book-picker-root ${className ?? ""}`.trim()}
      style={{ width: "100%", boxSizing: "border-box" }}
    >
      <BookGrid books={groups.oldTestament} onBookSelect={onBookSelect} />
      <hr style={dividerStyle} aria-hidden />
      <BookGrid books={groups.newTestament} onBookSelect={onBookSelect} />
      {showOther ? (
        <>
          <hr style={dividerStyle} aria-hidden />
          <OtherList books={groups.other} onBookSelect={onBookSelect} />
        </>
      ) : null}
    </div>
  );
}
