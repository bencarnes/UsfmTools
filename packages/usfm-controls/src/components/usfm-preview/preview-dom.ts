/**
 * Incremental DOM application for preview HTML.
 *
 * Replacing the whole preview via innerHTML forces the browser to restyle
 * and lay out the entire book on every refresh — multi-second freezes for
 * large books on modest hardware. The renderer's markup has stable
 * boundaries (an article/book head, then flat chapter sections), so successive renders are diffed as string chunks
 * and only the changed sections' DOM is swapped: typing restyles one
 * chapter, not one hundred and fifty.
 */

const CHAPTER_MARK = '<section class="usfm-chapter"';
const BOOK_MARK = '<section class="usfm-book"';

export interface PreviewChunks {
  /** Markup before the first chapter (article/book head). */
  readonly head: string;
  /**
   * One chunk per chapter section, in document order. The last chunk carries
   * the trailing close tags; parsed standalone, the HTML parser drops those
   * unmatched closers, yielding exactly the section element.
   */
  readonly chapters: readonly string[];
  /**
   * True when a book section starts after the first chapter (multi-book
   * document): inter-book markup then lives inside a chapter chunk, so
   * chunk-wise swapping is unsafe and a full swap is used instead.
   */
  readonly incompatible: boolean;
}

export function splitPreviewHtml(html: string): PreviewChunks {
  const first = html.indexOf(CHAPTER_MARK);
  if (first < 0) {
    return { head: html, chapters: [], incompatible: false };
  }
  const head = html.slice(0, first);
  const chapters: string[] = [];
  let pos = first;
  while (pos < html.length) {
    const next = html.indexOf(CHAPTER_MARK, pos + CHAPTER_MARK.length);
    if (next < 0) {
      chapters.push(html.slice(pos));
      break;
    }
    chapters.push(html.slice(pos, next));
    pos = next;
  }
  return {
    head,
    chapters,
    incompatible: html.indexOf(BOOK_MARK, first) >= 0,
  };
}

function parseFragment(doc: Document, html: string): DocumentFragment {
  const tpl = doc.createElement("template");
  tpl.innerHTML = html;
  return tpl.content;
}

/**
 * Bring `container` to show `html`, reusing the DOM of unchanged chunks.
 * `prev` is the chunk split of the currently applied HTML (null forces a
 * full swap). Returns the chunk split to pass on the next call.
 */
export function applyPreviewHtml(
  container: HTMLElement,
  html: string,
  prev: PreviewChunks | null,
): PreviewChunks {
  const next = splitPreviewHtml(html);
  const doc = container.ownerDocument;

  const fullSwap = () => {
    container.innerHTML = html;
    return next;
  };

  if (
    !prev ||
    prev.incompatible ||
    next.incompatible ||
    next.head !== prev.head ||
    next.chapters.length !== prev.chapters.length ||
    next.chapters.length === 0
  ) {
    return fullSwap();
  }

  const sections = container.querySelectorAll("section.usfm-chapter");
  if (sections.length !== next.chapters.length) return fullSwap();

  for (let i = 0; i < next.chapters.length; i++) {
    if (next.chapters[i] === prev.chapters[i]) continue;
    const el = parseFragment(doc, next.chapters[i]!).querySelector("section.usfm-chapter");
    if (!el) return fullSwap();
    sections[i]!.replaceWith(el);
  }
  return next;
}
