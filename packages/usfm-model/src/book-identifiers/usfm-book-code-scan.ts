/**
 * Parser-free extraction of a USFM file's book code: the first token after the
 * first `\id` marker — the same value as `parse(usfm)`'s first `book` node's
 * `code`, without pulling the parser into the caller's bundle.
 *
 * The scan mirrors the reference lexer's tokenization rules wherever they
 * decide whether a backslash starts a marker: escapes (`\\`, `\|`, `\~`),
 * nested (`\+id`) and end (`\id*`) markers, and quoted attribute values
 * (which may contain backslashes). Agreement with the parser is covered by a
 * differential test (corpus + randomized inputs).
 *
 * Known divergence: the parser nests an `\id` inside a preceding unclosed
 * top-level `\fig` or `\esb` (so it yields no top-level book), while this scan
 * still reports it. Only malformed files hit this — USFM requires `\id` to be
 * the first marker.
 */

const MARKER_NAME_CHAR = /[a-zA-Z_0-9-]/;

/**
 * Returns the raw (un-normalized) code following the first `\id` marker, `""`
 * when that marker has no code text on its line, or `undefined` when the text
 * has no `\id` marker at all.
 */
export function scanUsfmBookCode(usfm: string): string | undefined {
  const n = usfm.length;
  let i = 0;
  while (i < n) {
    const ch = usfm[i];
    if (ch === "|") {
      i = skipAttributes(usfm, i).end;
      continue;
    }
    if (ch !== "\\") {
      i++;
      continue;
    }
    const next = usfm[i + 1];
    if (next === "\\" || next === "|" || next === "~") {
      i += 2; // escaped character (text)
      continue;
    }
    let j = i + 1;
    if (usfm[j] === "+") j++;
    const nameStart = j;
    while (j < n && MARKER_NAME_CHAR.test(usfm[j]!)) j++;
    if (j === nameStart) {
      i = j; // bare backslash (text) or escaped newline
      continue;
    }
    if (usfm.slice(nameStart, j) === "id" && usfm[j] !== "*") {
      return codeFromIdLine(usfm, j);
    }
    i = j;
  }
  return undefined;
}

/**
 * The parser reads the code from the text tokens directly after `\id` up to
 * the end of the line (or the next non-text token), then takes the first
 * whitespace-delimited word.
 */
function codeFromIdLine(usfm: string, start: number): string {
  const n = usfm.length;
  let text = "";
  let i = start;
  while (i < n) {
    const ch = usfm[i]!;
    if (ch === "\n" || ch === "\r") break;
    if (ch === "/" && usfm[i + 1] === "/") break;
    if (ch === "|") {
      // An attribute token ends the text; an empty one emits no token, and
      // the text continues after it.
      const attr = skipAttributes(usfm, i);
      if (attr.emitsToken) break;
      i = attr.end;
      continue;
    }
    if (ch === "\\") {
      const next = usfm[i + 1];
      if (next === "\\" || next === "|" || next === "~") {
        text += next;
        i += 2;
        continue;
      }
      if (next === "\n" || next === "\r") break; // escaped newline → newline token
      let j = i + 1;
      if (usfm[j] === "+") j++;
      if (j < n && MARKER_NAME_CHAR.test(usfm[j]!)) break; // marker token
      text += "\\"; // bare backslash is text; a following "+" is dropped
      i = j;
      continue;
    }
    text += ch;
    i++;
  }
  return text.trimStart().split(/\s+/)[0] ?? "";
}

/**
 * Skip an attribute token starting at `|`: where ordinary scanning resumes,
 * and whether the lexer emits a token for it (it doesn't for a `|` with no
 * pairs and no default text). Only quoted `key="value"` pairs need skipping (their values may
 * contain backslashes that are not markers); unquoted default-attribute text
 * runs to the next backslash or line break.
 */
function skipAttributes(usfm: string, pipe: number): { end: number; emitsToken: boolean } {
  const n = usfm.length;
  let i = skipSpaces(usfm, pipe + 1);
  let hasKeyValue = false;
  while (i < n) {
    const keyStart = i;
    while (i < n && MARKER_NAME_CHAR.test(usfm[i]!)) i++;
    const hasKey = i > keyStart;
    i = skipSpaces(usfm, i);
    if (hasKey && usfm[i] === "=") {
      i = skipSpaces(usfm, i + 1);
      if (usfm[i] === '"') {
        i++;
        while (i < n && usfm[i] !== '"') {
          if (usfm[i] === "\\" && usfm[i + 1] === '"') i++;
          i++;
        }
        if (usfm[i] === '"') i++;
        hasKeyValue = true;
        i = skipSpaces(usfm, i);
        continue;
      }
    }
    if (hasKeyValue) return { end: keyStart, emitsToken: true };
    // Default attribute text: everything up to the next backslash or line break.
    i = keyStart;
    while (i < n && usfm[i] !== "\\" && usfm[i] !== "\n" && usfm[i] !== "\r") i++;
    return { end: i, emitsToken: i > keyStart };
  }
  return { end: i, emitsToken: hasKeyValue };
}

function skipSpaces(usfm: string, i: number): number {
  while (i < usfm.length && (usfm[i] === " " || usfm[i] === "\t")) i++;
  return i;
}
