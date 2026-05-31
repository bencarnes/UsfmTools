import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "../icons/chevron-down-icon.js";
import type { UsfmWorkspaceTabState } from "./workspace-model.js";

export interface TabListDropdownProps {
  readonly tabIds: readonly string[];
  readonly activeTabId: string | null;
  readonly tabsById: Readonly<Record<string, UsfmWorkspaceTabState>>;
  readonly onActivate: (tabId: string) => void;
}

/** Icon-only control listing open tabs; sits immediately after the tab strip. */
export function TabListDropdown({ tabIds, activeTabId, tabsById, onActivate }: TabListDropdownProps) {
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

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-stretch border-l border-gray-200">
      <button
        type="button"
        className="flex items-center justify-center px-1.5 py-1 text-gray-700 hover:bg-gray-100"
        title="Select tab"
        aria-label="Select tab"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDownIcon />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Open tabs"
          className="absolute left-0 top-full z-50 mt-0 max-h-60 min-w-[10rem] overflow-auto rounded border border-gray-300 bg-white py-1 shadow-md"
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
                    selected ? "bg-blue-50 font-medium text-blue-900" : "text-gray-800 hover:bg-gray-100"
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
      ) : null}
    </div>
  );
}
