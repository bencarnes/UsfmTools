import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "../icons/chevron-down-icon.js";
import { useResolvedTheme } from "../settings-pane/theme-scope.js";
import { PlusIcon } from "./shell-icons.js";
import type { UsfmShellRecentFolder } from "./host.js";

export interface FolderSelectorProps {
  readonly folderLabel: string;
  readonly folderPath: string;
  readonly recentFolders: readonly UsfmShellRecentFolder[];
  readonly onOpenFolder: (path: string) => void;
  readonly onPickFolder: () => void;
}

/** Bottom bar control for the current folder, recent folders, and opening a new folder. */
export function FolderSelector({
  folderLabel,
  folderPath,
  recentFolders,
  onOpenFolder,
  onPickFolder,
}: FolderSelectorProps) {
  const resolvedTheme = useResolvedTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const [menuRect, setMenuRect] = useState<{ bottom: number; left: number; width: number } | null>(null);

  const updateMenuRect = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setMenuRect({ bottom: window.innerHeight - r.top, left: r.left, width: r.width });
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
              aria-label="Recent folders"
              className="fixed z-[100] mb-0 max-h-60 min-w-[10rem] overflow-auto rounded border border-gray-300 bg-white py-1 text-gray-900 shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              style={{ bottom: menuRect.bottom, left: menuRect.left, minWidth: menuRect.width }}
            >
              {recentFolders.length === 0 ? (
                <li className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">No recent folders</li>
              ) : (
                recentFolders.map((folder) => {
                  const selected = folder.path === folderPath;
                  return (
                    <li key={folder.path} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        title={folder.path}
                        className={`block w-full truncate px-3 py-1.5 text-left text-sm ${
                          selected
                            ? "bg-blue-50 font-medium text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                            : "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        }`}
                        onClick={() => {
                          onOpenFolder(folder.path);
                          setOpen(false);
                        }}
                      >
                        {folder.label}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="flex shrink-0 items-stretch border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
      data-testid="usfm-shell-folder-selector"
    >
      <div
        className="min-w-0 flex-1 truncate px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200"
        title={folderPath}
        data-testid="usfm-shell-folder-selector-label"
      >
        {folderLabel}
      </div>
      <div ref={rootRef} className="flex shrink-0 items-stretch border-l border-gray-200 dark:border-gray-700">
        <button
          ref={buttonRef}
          type="button"
          className="flex items-center justify-center px-1.5 py-1 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="open recent folder"
          aria-label="open recent folder"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((v) => !v)}
          data-testid="usfm-shell-folder-selector-recent"
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          className="flex items-center justify-center border-l border-gray-200 px-1.5 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Open new folder"
          aria-label="Open new folder"
          onClick={onPickFolder}
          data-testid="usfm-shell-folder-selector-open"
        >
          <PlusIcon />
        </button>
      </div>
      {menu}
    </div>
  );
}
