import type { UsfmFilePickerFileInput } from "@usfm-tools/model";
import { UsfmFilePicker } from "../usfm-file-picker/index.js";

export interface FileBrowserProps {
  readonly files: readonly UsfmFilePickerFileInput[];
  readonly activeFileId: string | null;
  readonly onOpenFile: (entry: UsfmFilePickerFileInput) => void;
  readonly loading: boolean;
  readonly label: string;
  readonly onPickFolder?: () => void | Promise<void>;
  readonly pickingFolder?: boolean;
}

export function FileBrowser({
  files,
  activeFileId,
  onOpenFile,
  loading,
  label,
  onPickFolder,
  pickingFolder = false,
}: FileBrowserProps) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="usfm-shell-file-browser">
      {onPickFolder ? (
        <div className="border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-left text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            onClick={() => void onPickFolder()}
            disabled={pickingFolder}
            data-testid="usfm-shell-pick-folder"
          >
            {pickingFolder ? "Choosing folder…" : "Choose USFM folder…"}
          </button>
        </div>
      ) : null}
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
