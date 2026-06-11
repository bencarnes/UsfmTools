import type { UsfmFilePickerFileInput } from "@usfm-tools/model";
import { UsfmFilePicker } from "../usfm-file-picker/index.js";

export interface FileBrowserProps {
  readonly files: readonly UsfmFilePickerFileInput[];
  readonly activeFileId: string | null;
  readonly onOpenFile: (entry: UsfmFilePickerFileInput) => void;
  readonly loading: boolean;
  readonly label: string;
}

export function FileBrowser({ files, activeFileId, onOpenFile, loading, label }: FileBrowserProps) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="usfm-shell-file-browser">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {label}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loading ? (
          <div className="px-1 py-2 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-1 py-2 text-sm text-gray-500 dark:text-gray-400">No files in folder</div>
        ) : (
          <UsfmFilePicker
            files={files}
            activeFileId={activeFileId}
            onFileSelect={({ fileId }) => {
              const entry = files.find((f) => f.id === fileId);
              if (entry) onOpenFile(entry);
            }}
            fileTestIdPrefix="usfm-shell-file"
          />
        )}
      </div>
    </div>
  );
}
