import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useResolvedTheme } from "../settings-pane/theme-scope.js";

export interface TabContextMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  /** When true the item is shown greyed out and cannot be chosen (e.g. "Close Others" on a lone tab). */
  readonly disabled?: boolean;
}

export interface TabContextMenuProps {
  /** Viewport coordinates the menu opens at, typically the right-click pointer position. */
  readonly x: number;
  readonly y: number;
  readonly items: readonly TabContextMenuItem[];
  /** Dismiss the menu (outside click, Escape, or after an item is chosen). */
  readonly onDismiss: () => void;
}

/**
 * Small right-click menu for a tab. Rendered into a portal at the pointer position and clamped to
 * stay inside the viewport, mirroring how {@link TabListDropdown} escapes the clipped tab strip.
 * Dismisses on outside click, Escape, or after a selection.
 */
export function TabContextMenu({ x, y, items, onDismiss }: TabContextMenuProps) {
  const resolvedTheme = useResolvedTheme();
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: y, left: x });

  // Keep the menu on-screen: shift it up/left when it would overflow the right or bottom edge.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 4;
    let left = x;
    let top = y;
    if (left + rect.width + margin > window.innerWidth) left = Math.max(margin, window.innerWidth - rect.width - margin);
    if (top + rect.height + margin > window.innerHeight) top = Math.max(margin, window.innerHeight - rect.height - margin);
    setPos({ top, left });
  }, [x, y]);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    // Defer wiring so the opening click/contextmenu doesn't immediately close the menu.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointer);
      document.addEventListener("contextmenu", onPointer);
      document.addEventListener("keydown", onKey);
    }, 0);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onDismiss, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("contextmenu", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
    };
  }, [onDismiss]);

  return createPortal(
    <div className={resolvedTheme === "dark" ? "dark" : undefined}>
      <ul
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label="Tab actions"
        className="fixed z-[100] min-w-[9rem] overflow-hidden rounded border border-gray-300 bg-white py-1 text-gray-900 shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        style={{ top: pos.top, left: pos.left }}
      >
        {items.map((item) => (
          <li key={item.label} role="presentation">
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100 disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:text-gray-500 dark:disabled:hover:bg-transparent"
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                onDismiss();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
