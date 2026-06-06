import { useEffect, useId, useRef, useState } from "react";
import type { WorkspaceGridDimension } from "../usfm-workspace/workspace-model.js";

export interface TabGroupLayoutSelectorProps {
  readonly gridRows: WorkspaceGridDimension;
  readonly gridCols: WorkspaceGridDimension;
  readonly onChange: (rows: WorkspaceGridDimension, cols: WorkspaceGridDimension) => void;
  readonly className?: string;
}

function IconGrid2x2() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="block">
      <rect x="1.5" y="1.5" width="15" height="15" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line x1="9" y1="2.5" x2="9" y2="15.5" stroke="currentColor" strokeWidth="1.1" />
      <line x1="2.5" y1="9" x2="15.5" y2="9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/**
 * Dropdown control for choosing a tab-group grid up to 2×2. Clicking cell (row, col) sets
 * `gridRows = row + 1` and `gridCols = col + 1` (corner-based sizing).
 */
export function TabGroupLayoutSelector({ gridRows, gridCols, onChange, className }: TabGroupLayoutSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = `Tab group layout ${gridRows}×${gridCols}`;

  return (
    <div ref={rootRef} className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <IconGrid2x2 />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Tab group grid layout"
          className="absolute left-0 top-full z-50 mt-1 rounded border border-gray-300 bg-white p-2 shadow-md dark:border-gray-600 dark:bg-gray-800"
        >
          <div className="grid grid-cols-2 gap-1" style={{ width: "4.5rem" }}>
            {[0, 1].map((row) =>
              [0, 1].map((col) => {
                const active = row < gridRows && col < gridCols;
                const rows = (row + 1) as WorkspaceGridDimension;
                const cols = (col + 1) as WorkspaceGridDimension;
                const isCurrent = gridRows === rows && gridCols === cols;
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    title={`${rows}×${cols} layout`}
                    className={`h-8 w-8 rounded border ${
                      isCurrent
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400 dark:border-blue-400 dark:bg-blue-950/50 dark:ring-blue-500"
                        : active
                          ? "border-gray-400 bg-gray-100 dark:border-gray-500 dark:bg-gray-700"
                          : "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => {
                      onChange(rows, cols);
                      setOpen(false);
                    }}
                  />
                );
              }),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
