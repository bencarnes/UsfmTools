import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "../icons/chevron-down-icon.js";
import { useResolvedTheme } from "../settings-pane/theme-scope.js";
import type { UsfmWorkspaceTabState } from "./workspace-model.js";

export interface TabListDropdownProps {
  readonly tabIds: readonly string[];
  readonly activeTabId: string | null;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivate: (tabId: string) => void;
}

/** Icon-only control listing open tabs; sits immediately after the tab strip. */
export function TabListDropdown({ tabIds, activeTabId, tabsById, onActivate }: TabListDropdownProps) {
  const resolvedTheme = useResolvedTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const [menuRect, setMenuRect] = useState<{ top: number; left: number } | null>(null);

  const updateMenuRect = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setMenuRect({ top: r.bottom, left: r.left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [open, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const menu = document.getElementById(listId);
      if (menu?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, listId]);

  const menu =
    open && menuRect
      ? createPortal(
          <div className={resolvedTheme === "dark" ? "dark" : undefined}>
            <ul
              id={listId}
              role="listbox"
              aria-label="Open tabs"
              className="fixed z-[100] mt-0 max-h-60 min-w-[10rem] overflow-auto rounded border border-gray-300 bg-white py-1 text-gray-900 shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              style={{ top: menuRect.top, left: menuRect.left }}
            >
              {tabIds.map((tid) => {
                const tab = tabsById[tid];
                if (!tab) return null;
                const selected = tid === activeTabId;
                return (
                  <li key={tid} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`block w-full truncate px-3 py-1.5 text-left text-sm ${
                        selected
                          ? "bg-blue-50 font-medium text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                          : "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => {
                        onActivate(tid);
                        setOpen(false);
                      }}
                    >
                      {tab.fileName}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-stretch border-l border-gray-200 dark:border-gray-700">
      <button
        ref={buttonRef}
        type="button"
        className="flex items-center justify-center px-1.5 py-1 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Select tab"
        aria-label="Select tab"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDownIcon />
      </button>
      {menu}
    </div>
  );
}
