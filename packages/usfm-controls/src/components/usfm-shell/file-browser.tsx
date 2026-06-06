import type { UsfmShellFileEntry } from "./host.js";

export interface FileBrowserProps {
  readonly files: readonly UsfmShellFileEntry[];
  readonly activeFileId: string | null;
  readonly onOpenFile: (entry: UsfmShellFileEntry) => void;
  readonly loading: boolean;
  readonly label: string;
}

export function FileBrowser({ files, activeFileId, onOpenFile, loading, label }: FileBrowserProps) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="usfm-shell-file-browser">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {label}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No files in folder</div>
        ) : (
          <ul className="py-1">
            {files.map((f) => {
              const active = f.id === activeFileId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`block w-full truncate px-3 py-1 text-left text-sm ${
                      active
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                        : "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => onOpenFile(f)}
                    aria-current={active ? "true" : undefined}
                    data-testid={`usfm-shell-file-${f.name}`}
                  >
                    {f.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
