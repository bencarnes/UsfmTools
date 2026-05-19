import type { UsfmRenderTemplate } from "./types.js";

/**
 * Merge a partial template over a base (typically {@link defaultPublicationTemplate}).
 * Shallow per-key override: each function can be replaced independently.
 */
export function mergePublicationTemplate(
  base: UsfmRenderTemplate,
  overrides: Partial<UsfmRenderTemplate>,
): UsfmRenderTemplate {
  return { ...base, ...overrides };
}
