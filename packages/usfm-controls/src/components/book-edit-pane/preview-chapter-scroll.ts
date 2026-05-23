/**
 * Scroll a preview scroll container so the chapter section with {@link chapterNumber}
 * is aligned near the top. When {@link chapterNumber} is `null`, scrolls to the top.
 */
export function scrollPreviewContainerToChapter(
  scrollRoot: HTMLElement | null,
  chapterNumber: string | null,
): void {
  if (!scrollRoot) return;
  if (!chapterNumber) {
    scrollRoot.scrollTop = 0;
    return;
  }
  const sections = scrollRoot.querySelectorAll("section.usfm-chapter[data-chapter]");
  const el = Array.from(sections).find((n) => n.getAttribute("data-chapter") === chapterNumber);
  if (!el || !(el instanceof HTMLElement)) {
    scrollRoot.scrollTop = 0;
    return;
  }
  const rootRect = scrollRoot.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  scrollRoot.scrollTop = Math.max(0, elRect.top - rootRect.top + scrollRoot.scrollTop - 4);
}

/**
 * Chapter number for the first `section.usfm-chapter` whose lower edge is below a
 * small margin from the top of {@link scrollRoot}, or `null` if none apply.
 */
export function topVisibleChapterNumberInPreview(scrollRoot: HTMLElement | null): string | null {
  if (!scrollRoot) return null;
  const top = scrollRoot.getBoundingClientRect().top + 2;
  const sections = scrollRoot.querySelectorAll("section.usfm-chapter[data-chapter]");
  for (const sec of sections) {
    const r = sec.getBoundingClientRect();
    if (r.bottom > top) {
      return sec.getAttribute("data-chapter");
    }
  }
  return null;
}
