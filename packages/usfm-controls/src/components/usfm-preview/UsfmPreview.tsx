import { useMemo } from "react";
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
  className?: string;
}

/**
 * Read-only preview of USFM as continuous scripture HTML (similar to a Bible app).
 * Style the output via the `usfm-*` CSS class hooks (see package README).
 */
export function UsfmPreview({ value, versePerLine, className }: UsfmPreviewProps) {
  const versePerLineOn = normalizeVersePerLine(versePerLine);

  const html = useMemo(
    () => renderPreviewHtml(value, { versePerLine: versePerLineOn }),
    [value, versePerLineOn],
  );

  return (
    <div
      className={`usfm-preview-root ${className ?? ""}`}
      // Trusted HTML: renderPreviewHtml escapes all user-supplied text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
