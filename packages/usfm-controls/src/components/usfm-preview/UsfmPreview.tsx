import { useMemo } from "react";
import {
  parse,
  UsfmRenderer,
  defaultPublicationTemplate,
  mergePublicationTemplate,
  type UsfmRenderTemplate,
} from "@usfm-tools/model";

const defaultTmpl = defaultPublicationTemplate();

export interface UsfmPreviewProps {
  /** Raw USFM source to render. */
  value: string;
  /**
   * Partial template merged over the default publication template.
   * Memoize this object in the parent if overrides are stable but the parent re-renders often.
   */
  template?: Partial<UsfmRenderTemplate>;
  /**
   * When true, a single USFM paragraph that contains multiple `\\v` milestones is split so
   * each verse appears on its own preview line.
   */
  versePerLine?: boolean;
  className?: string;
}

/**
 * Read-only preview of USFM as continuous scripture HTML (similar to a Bible app).
 * Uses {@link UsfmRenderer} under the hood; parsing and HTML generation are memoized
 * by `value`, `template`, and `versePerLine` for fast updates alongside {@link UsfmEditor}.
 */
export function UsfmPreview({ value, template, versePerLine = false, className }: UsfmPreviewProps) {
  const mergedTemplate = useMemo(() => {
    if (!template) return defaultTmpl;
    return mergePublicationTemplate(defaultTmpl, template);
  }, [template]);

  const html = useMemo(() => {
    const { document, errors } = parse(value);
    const renderer = new UsfmRenderer(mergedTemplate);
    let body = renderer.renderDocument(document, { versePerLine });
    if (errors.length > 0) {
      const parts = errors.map((e) => `<span>${mergedTemplate.escapeText(e.message)}</span>`);
      body = `<aside class="usfm-preview-errors" role="status">${parts.join(" ")}</aside>${body}`;
    }
    return body;
  }, [value, mergedTemplate, versePerLine]);

  return (
    <div
      className={`usfm-preview-root ${className ?? ""}`}
      // Trusted HTML: built only from escaped USFM via UsfmRenderTemplate.escapeText on user text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
