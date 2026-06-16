/**
 * Drop-target resolution for workspace drags, shared between in-workspace tab dragging and the
 * shell's "drag a file from the sidebar into a tab group" gesture.
 *
 * Both gestures are pointer-based (see {@link ../usfm-workspace/UsfmWorkspace} for why not HTML5
 * DnD) and locate their target by hit-testing the live DOM: tab strips expose
 * `data-workspace-strip` and empty groups expose `data-workspace-empty-slot`, each carrying the
 * group id. Because the lookup is purely DOM-based it works regardless of which React subtree
 * started the drag.
 */
export interface TabDropTarget {
  readonly groupId: string;
  readonly insertIndex: number;
}

/** Insertion index for `clientX` within a tab strip element (VS Code-style midpoint behavior). */
export function insertIndexInStrip(stripEl: Element, clientX: number): number {
  const buttons = [...stripEl.querySelectorAll<HTMLElement>("[data-workspace-tab-id]")];
  for (let i = 0; i < buttons.length; i++) {
    const r = buttons[i]!.getBoundingClientRect();
    if (clientX < r.left + r.width / 2) return i;
  }
  return buttons.length;
}

/** Resolve the drop target (group + insertion index) under a screen point, if any. */
export function dropTargetAtPoint(clientX: number, clientY: number): TabDropTarget | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const empty = el.closest<HTMLElement>("[data-workspace-empty-slot]");
  if (empty?.dataset.workspaceEmptySlot) {
    return { groupId: empty.dataset.workspaceEmptySlot, insertIndex: 0 };
  }
  const strip = el.closest<HTMLElement>("[data-workspace-strip]");
  if (strip?.dataset.workspaceStrip) {
    return { groupId: strip.dataset.workspaceStrip, insertIndex: insertIndexInStrip(strip, clientX) };
  }
  return null;
}
