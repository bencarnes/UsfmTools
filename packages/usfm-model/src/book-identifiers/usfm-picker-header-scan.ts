/** Matches a USFM chapter marker at the start of a line (`\c` or `\c 1`). */
const CHAPTER_LINE_RE = /^\s*\\c(\s|$)/;

export interface UsfmPickerHeaderScanResult {
  /** Lines before the first `\c` marker (or the full file when no chapter marker appears). */
  readonly headerUsfm: string;
  /** True when the file contains any non-whitespace content. */
  readonly isNonempty: boolean;
}

export interface UsfmPickerHeaderScanState {
  readonly lines: string[];
  readonly isNonempty: boolean;
  readonly stopped: boolean;
}

export function createUsfmPickerHeaderScanState(): UsfmPickerHeaderScanState {
  return { lines: [], isNonempty: false, stopped: false };
}

/**
 * Consume one line of USFM. Scanning stops before the first `\c` chapter marker.
 * Returns an updated state; when `stopped` is true, no further lines should be fed.
 */
export function consumeUsfmPickerHeaderLine(
  line: string,
  state: UsfmPickerHeaderScanState,
): UsfmPickerHeaderScanState {
  if (state.stopped) return state;

  const trimmed = line.trim();
  if (trimmed.length > 0) {
    state = { ...state, isNonempty: true };
  }

  if (CHAPTER_LINE_RE.test(line)) {
    return { ...state, stopped: true };
  }

  return { ...state, lines: [...state.lines, line] };
}

/** Finalize a scan into the minimal USFM snippet used by the file/book pickers. */
export function finalizeUsfmPickerHeaderScan(state: UsfmPickerHeaderScanState): UsfmPickerHeaderScanResult {
  if (!state.isNonempty) {
    return { headerUsfm: "", isNonempty: false };
  }

  let headerUsfm = state.lines.join("\n");
  if (headerUsfm.trim().length === 0) {
    // File has body but no pre-chapter metadata (for example starts with `\c`).
    headerUsfm = "\\p\n";
  }
  return { headerUsfm, isNonempty: true };
}

/** Scan a full in-memory USFM string line by line (fallback when hosts lack streaming reads). */
export function scanUsfmPickerHeaderFromText(text: string): UsfmPickerHeaderScanResult {
  let state = createUsfmPickerHeaderScanState();
  for (const line of text.split(/\r\n|\r|\n/)) {
    state = consumeUsfmPickerHeaderLine(line, state);
    if (state.stopped) break;
  }
  return finalizeUsfmPickerHeaderScan(state);
}

/** Drive a line source until the picker header scan completes. */
export async function scanUsfmPickerHeader(
  readLine: () => Promise<string | null>,
): Promise<UsfmPickerHeaderScanResult> {
  let state = createUsfmPickerHeaderScanState();
  while (true) {
    const line = await readLine();
    if (line === null) break;
    state = consumeUsfmPickerHeaderLine(line, state);
    if (state.stopped) break;
  }
  return finalizeUsfmPickerHeaderScan(state);
}
