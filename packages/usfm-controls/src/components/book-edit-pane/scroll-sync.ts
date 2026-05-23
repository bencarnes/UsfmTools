/**
 * Split-pane scroll alignment between USFM source offsets and preview DOM.
 * Chapter and verse numbers are always treated as opaque strings (never parsed as integers).
 *
 * Sync modes: with `\c` markers, use chapter+verse; without chapters, use paragraph index
 * only when both `\v` and `\p` milestones exist; otherwise do not sync.
 */

export type ScrollSyncMode = "chapter-verse" | "paragraph" | "none";

export function scrollSyncModeFromMarkers(
  hasChapterMarkers: boolean,
  bookSourceSlice: string,
): ScrollSyncMode {
  if (hasChapterMarkers) return "chapter-verse";
  if (!hasVerseMarker(bookSourceSlice)) return "none";
  if (hasParagraphMarker(bookSourceSlice)) return "paragraph";
  return "none";
}

function hasVerseMarker(bookSlice: string): boolean {
  return /(?:^|\n)\\v(?=\s|$)/m.test(bookSlice);
}

function hasParagraphMarker(bookSlice: string): boolean {
  return /(?:^|\n)\\p(?=\s|$)/m.test(bookSlice);
}

/** @internal */
export function listParagraphMarkerOffsetsInRange(text: string, from: number, to: number): readonly number[] {
  const slice = text.slice(from, to);
  const out: number[] = [];
  const re = /(^|\n)\\p(?=\s|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const rel = m.index + (m[1] === "\n" ? 1 : 0);
    out.push(from + rel);
  }
  return out;
}

/** 0-based paragraph index: which `\\p` block contains {@link offset}. */
export function paragraphIndexAtSourceOffset(
  fullText: string,
  bookStart: number,
  offset: number,
): number {
  const offs = listParagraphMarkerOffsetsInRange(fullText, bookStart, fullText.length);
  if (offs.length === 0) return 0;
  let lo = 0;
  let hi = offs.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = offs[mid]!;
    if (p <= offset) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function sourceOffsetForParagraphIndex(
  fullText: string,
  bookStart: number,
  paraIndex: number,
): number | null {
  const offs = listParagraphMarkerOffsetsInRange(fullText, bookStart, fullText.length);
  if (offs.length === 0) return bookStart;
  const clamped = Math.max(0, Math.min(paraIndex, offs.length - 1));
  return offs[clamped] ?? bookStart;
}

/** Last `\\v` milestone number (verbatim) between {@link from} (inclusive) and {@link to} (exclusive). */
export function lastVerseNumberBeforeOffset(fullText: string, from: number, to: number): string | null {
  const slice = fullText.slice(from, to);
  const re = /\\v\s+(\S+)/g;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    last = m[1] ?? null;
  }
  return last;
}

export function nextChapterMarkerOffset(
  markers: readonly { markerOffset: number }[],
  chapterMarkerOffset: number,
): number | null {
  const idx = markers.findIndex((m) => m.markerOffset > chapterMarkerOffset);
  if (idx === -1) return null;
  return markers[idx]!.markerOffset;
}

export function sourceOffsetForChapterVerse(
  fullText: string,
  markers: readonly { markerOffset: number }[],
  chapterMarkerOffset: number,
  verseNumber: string | null,
): number | null {
  const searchFrom = chapterMarkerOffset;
  const next = nextChapterMarkerOffset(markers, chapterMarkerOffset);
  const searchTo = next ?? fullText.length;
  if (verseNumber == null) return searchFrom;
  const slice = fullText.slice(searchFrom, searchTo);
  let pos = 0;
  while (pos < slice.length) {
    const rel = slice.indexOf("\\v", pos);
    if (rel === -1) break;
    let j = rel + 2;
    while (j < slice.length && /\s/.test(slice[j]!)) j++;
    let k = j;
    while (k < slice.length && !/\s/.test(slice[k]!)) k++;
    const num = slice.slice(j, k);
    if (num === verseNumber) return searchFrom + rel;
    pos = rel + 2;
  }
  return searchFrom;
}

export type CvScrollAnchor = {
  readonly kind: "cv";
  readonly chapterNumber: string | null;
  readonly verseNumber: string | null;
};

export type ParaScrollAnchor = {
  readonly kind: "para";
  readonly paragraphIndex: number;
};

export type ScrollAnchor = CvScrollAnchor | ParaScrollAnchor;

export function scrollPreviewToAnchor(scrollRoot: HTMLElement | null, mode: ScrollSyncMode, anchor: ScrollAnchor): void {
  if (!scrollRoot || mode === "none") return;
  if (anchor.kind === "para") {
    const el = scrollRoot.querySelector(`p.usfm-line[data-usfm-para-index="${String(anchor.paragraphIndex)}"]`);
    scrollElementToTopOfContainer(scrollRoot, el);
    return;
  }
  const { chapterNumber, verseNumber } = anchor;
  if (chapterNumber == null) {
    if (verseNumber != null) {
      const v = Array.from(scrollRoot.querySelectorAll("sup.usfm-v[data-verse]")).find(
        (n) => n.getAttribute("data-verse") === verseNumber,
      );
      scrollElementToTopOfContainer(scrollRoot, v ?? null);
      return;
    }
    scrollRoot.scrollTop = 0;
    return;
  }
  const chSection = Array.from(scrollRoot.querySelectorAll("section.usfm-chapter[data-chapter]")).find(
    (n) => n.getAttribute("data-chapter") === chapterNumber,
  );
  if (!chSection) {
    scrollRoot.scrollTop = 0;
    return;
  }
  if (verseNumber == null) {
    scrollElementToTopOfContainer(scrollRoot, chSection);
    return;
  }
  const verseEl = Array.from(chSection.querySelectorAll("sup.usfm-v[data-verse]")).find(
    (n) => n.getAttribute("data-verse") === verseNumber,
  );
  if (verseEl instanceof HTMLElement) {
    scrollElementToTopOfContainer(scrollRoot, verseEl);
    return;
  }
  scrollElementToTopOfContainer(scrollRoot, chSection);
}

function scrollElementToTopOfContainer(scrollRoot: HTMLElement, el: Element | null): void {
  if (!el || !(el instanceof HTMLElement)) {
    scrollRoot.scrollTop = 0;
    return;
  }
  const rootRect = scrollRoot.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  scrollRoot.scrollTop = Math.max(0, elRect.top - rootRect.top + scrollRoot.scrollTop - 4);
}

export function readTopVisibleScrollAnchor(scrollRoot: HTMLElement | null, mode: ScrollSyncMode): ScrollAnchor | null {
  if (!scrollRoot || mode === "none") return null;
  const x = scrollRoot.getBoundingClientRect().left + scrollRoot.clientWidth / 2;
  const y = scrollRoot.getBoundingClientRect().top + 6;
  const stack = scrollRoot.ownerDocument.elementsFromPoint(x, y);
  if (mode === "paragraph") {
    const line = stack.find(
      (n) => n instanceof HTMLElement && n.matches("p.usfm-line[data-usfm-para-index]"),
    ) as HTMLElement | undefined;
    if (!line) return null;
    const raw = line.getAttribute("data-usfm-para-index");
    if (raw == null) return null;
    return { kind: "para", paragraphIndex: Number.parseInt(raw, 10) };
  }
  const line = stack.find((n) => n instanceof HTMLElement && n.matches("p.usfm-line")) as HTMLElement | undefined;
  if (!line) return null;
  const verseEl = line.querySelector("sup.usfm-v[data-verse]") as HTMLElement | null;
  const verseNumber = verseEl?.getAttribute("data-verse") ?? null;
  const chSection = line.closest("section.usfm-chapter[data-chapter]");
  const chapterNumber = chSection?.getAttribute("data-chapter") ?? null;
  return {
    kind: "cv",
    chapterNumber,
    verseNumber,
  };
}
