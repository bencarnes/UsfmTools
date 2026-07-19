import { memo, useEffect, useRef, useState } from "react";
import type { UsfmLanguageClient } from "../../language-service/protocol.js";
import { sharedLocalLanguageClient } from "../../language-service/local-client.js";

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
   * When set, render the language client's synced copy of this document
   * instead of shipping `value` to the client (which stays as the fallback,
   * e.g. when the document closes mid-request). Pass the id reported by the
   * co-mounted editor's `onDocumentIdChange`.
   */
  documentId?: string | null;
  /**
   * When true, a single USFM paragraph that contains multiple `\\v` milestones is split so
   * each verse appears on its own preview line.
   */
  versePerLine?: boolean;
  /**
   * Milliseconds to wait after the last `value` change before re-rendering the preview.
   * Use in split editor+preview layouts to avoid re-rendering on every keystroke.
   */
  updateDebounceMs?: number;
  /**
   * Language client whose `renderPreview` produces the HTML (e.g. the Go
   * engine in bible-edit). Defaults to the in-process TypeScript renderer.
   */
  languageClient?: UsfmLanguageClient;
  className?: string;
}

/**
 * Read-only preview of USFM as continuous scripture HTML (similar to a Bible app).
 * Style the output via the `usfm-*` CSS class hooks (see package README).
 */
export const UsfmPreview = memo(function UsfmPreview({
  value,
  documentId,
  versePerLine,
  updateDebounceMs = 0,
  languageClient,
  className,
}: UsfmPreviewProps) {
  const versePerLineOn = normalizeVersePerLine(versePerLine);
  const [renderValue, setRenderValue] = useState(value);
  const [html, setHtml] = useState("");
  const generationRef = useRef(0);

  useEffect(() => {
    if (updateDebounceMs <= 0) {
      setRenderValue(value);
      return;
    }
    const timer = setTimeout(() => setRenderValue(value), updateDebounceMs);
    return () => clearTimeout(timer);
  }, [value, updateDebounceMs]);

  useEffect(() => {
    const client = languageClient ?? sharedLocalLanguageClient();
    const generation = ++generationRef.current;
    const renderFromText = () => client.renderPreview(renderValue, { versePerLine: versePerLineOn });
    const rendering = documentId
      ? client
          .renderPreviewDocument(documentId, { versePerLine: versePerLineOn })
          .then((r) => r.html)
          // Document closed mid-request (e.g. the editor is remounting).
          .catch(() => renderFromText())
      : renderFromText();
    rendering
      .then((rendered) => {
        // Keep showing the previous preview if a newer render is already
        // underway (or the component re-rendered with different input).
        if (generation === generationRef.current) setHtml(rendered);
      })
      .catch(() => {
        // Client unavailable (e.g. backend restarting): keep the last HTML.
      });
  }, [renderValue, versePerLineOn, languageClient, documentId]);

  return (
    <div
      className={`usfm-preview-root ${className ?? ""}`}
      // Trusted HTML: renderPreview escapes all user-supplied text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
