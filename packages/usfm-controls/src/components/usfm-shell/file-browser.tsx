import type { UsfmFilePickerFileInput } from "@usfm-tools/model";
import { UsfmFilePicker } from "../usfm-file-picker/index.js";
import { FolderSelector } from "./folder-selector.js";
import type { UsfmShellRecentFolder } from "./host.js";

export interface FileBrowserProps {
  readonly files: readonly UsfmFilePickerFileInput[];
  readonly activeFileId: string | null;
  readonly onOpenFile: (entry: UsfmFilePickerFileInput) => void;
  readonly loading: boolean;
  readonly folderLabel: string;
  readonly folderPath: string;
  readonly recentFolders: readonly UsfmShellRecentFolder[];
  readonly onOpenFolder: (path: string) => void;
  readonly onPickFolder: () => void;
}

export function FileBrowser({
  files,
  activeFileId,
  onOpenFile,
  loading,
  folderLabel,
  folderPath,
  recentFolders,
  onOpenFolder,
  onPickFolder,
}: FileBrowserProps) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="usfm-shell-file-browser">
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
      <FolderSelector
        folderLabel={folderLabel}
        folderPath={folderPath}
        recentFolders={recentFolders}
        onOpenFolder={onOpenFolder}
        onPickFolder={onPickFolder}
      />
    </div>
  );
}
