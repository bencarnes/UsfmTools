import { memo, useEffect, useMemo, useState } from "react";
import { renderPreviewHtml } from "@usfm-tools/model";

/** Storybook (and URL state) may supply boolean controls as strings. */
function normalizeVersePerLine(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (typeof raw === "string" && raw.toLowerCase() === "true") return true;
  return false;
}

export interface UsfmPreviewProps {
  /** Raw USFM source to render. */
  value: string;
  /**
   * When true, a single USFM paragraph that contains multiple `\\v` milestones is split so
   * each verse appears on its own preview line.
   */
  versePerLine?: boolean;
  /**
   * Milliseconds to wait after the last `value` change before re-rendering the preview.
   * Use in split editor+preview layouts to avoid re-parsing on every keystroke.
   */
  updateDebounceMs?: number;
  className?: string;
}

/**
 * Read-only preview of USFM as continuous scripture HTML (similar to a Bible app).
 * Style the output via the `usfm-*` CSS class hooks (see package README).
 */
export const UsfmPreview = memo(function UsfmPreview({
  value,
  versePerLine,
  updateDebounceMs = 0,
  className,
}: UsfmPreviewProps) {
  const versePerLineOn = normalizeVersePerLine(versePerLine);
  const [renderValue, setRenderValue] = useState(value);

  useEffect(() => {
    if (updateDebounceMs <= 0) {
      setRenderValue(value);
      return;
    }
    const timer = setTimeout(() => setRenderValue(value), updateDebounceMs);
    return () => clearTimeout(timer);
  }, [value, updateDebounceMs]);

  const html = useMemo(
    () => renderPreviewHtml(renderValue, { versePerLine: versePerLineOn }),
    [renderValue, versePerLineOn],
  );

  return (
    <div
      className={`usfm-preview-root ${className ?? ""}`}
      // Trusted HTML: renderPreviewHtml escapes all user-supplied text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
