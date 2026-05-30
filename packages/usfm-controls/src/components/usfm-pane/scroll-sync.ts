/**
 * Split-pane scroll alignment between USFM source offsets and preview DOM.
 * Chapter and verse numbers are always treated as opaque strings (never parsed as integers).
 *
 * Synchronization runs only when the book has `\\c` chapter markers (chapter + verse anchors).
 * Books without chapters do not sync scroll between editor and preview.
 */

export type ScrollSyncMode = "chapter-verse" | "none";

export function scrollSyncModeFromMarkers(hasChapterMarkers: boolean): ScrollSyncMode {
  return hasChapterMarkers ? "chapter-verse" : "none";
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

export type ScrollAnchor = CvScrollAnchor;

export function scrollPreviewToAnchor(
  scrollRoot: HTMLElement | null,
  mode: ScrollSyncMode,
  anchor: ScrollAnchor,
): void {
  if (!scrollRoot || mode === "none") return;
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

export function readTopVisibleScrollAnchor(
  scrollRoot: HTMLElement | null,
  mode: ScrollSyncMode,
): ScrollAnchor | null {
  if (!scrollRoot || mode === "none") return null;
  const x = scrollRoot.getBoundingClientRect().left + scrollRoot.clientWidth / 2;
  const y = scrollRoot.getBoundingClientRect().top + 6;
  const stack = scrollRoot.ownerDocument.elementsFromPoint(x, y);
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
