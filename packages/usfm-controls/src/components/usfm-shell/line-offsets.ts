/**
 * Convert a 0-based line / 0-based column inside `content` to a clamped source offset.
 * Used to translate language-service diagnostic positions and search-match positions
 * into the offsets that `UsfmPane` / `UsfmEditor` use.
 */
export function lineColumnToSourceOffset(content: string, line: number, column: number): number {
  const len = content.length;
  let offset = 0;
  let cur = 0;
  while (cur < line && offset < len) {
    const nl = content.indexOf("\n", offset);
    if (nl < 0) return len;
    offset = nl + 1;
    cur++;
  }
  const lineEndRaw = content.indexOf("\n", offset);
  const lineEnd = lineEndRaw < 0 ? len : lineEndRaw;
  const lineLength = lineEnd - offset;
  return offset + Math.max(0, Math.min(column, lineLength));
}

/**
 * Convert a source offset to a 0-based line / 0-based column inside `content`.
 * Counterpart to {@link lineColumnToSourceOffset}.
 */
export function sourceOffsetToLineColumn(content: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, content.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart };
}
