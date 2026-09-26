import type { PointerEvent as ReactPointerEvent } from "react";
import type { UsfmFilePickerGroups } from "@usfm-tools/model";
import { UsfmFilePicker } from "../usfm-file-picker/index.js";
import { FolderSelector } from "./folder-selector.js";
import type { UsfmShellFileEntry, UsfmShellRecentFolder } from "./host.js";

export interface FileBrowserProps {
  readonly fileEntries: readonly UsfmShellFileEntry[];
  readonly catalog: UsfmFilePickerGroups;
  readonly activeFileId: string | null;
  readonly onOpenFile: (entry: UsfmShellFileEntry) => void;
  /** Begin dragging a file row toward a workspace tab group. */
  readonly onFileDragStart: (e: ReactPointerEvent, entry: UsfmShellFileEntry) => void;
  /** Swallow the click that ends a drag so it does not also open the file in place. */
  readonly consumeFileDragEnd: () => boolean;
  readonly loading: boolean;
  readonly folderLabel: string;
  readonly folderPath: string;
  readonly recentFolders: readonly UsfmShellRecentFolder[];
  readonly onOpenFolder: (path: string) => void;
  readonly onPickFolder: () => void;
}

export function FileBrowser({
  fileEntries,
  catalog,
  activeFileId,
  onOpenFile,
  onFileDragStart,
  consumeFileDragEnd,
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
        ) : fileEntries.length === 0 ? (
          <div className="px-1 py-2 text-sm text-gray-500 dark:text-gray-400">No files in folder</div>
        ) : (
          <UsfmFilePicker
            groups={catalog}
            activeFileId={activeFileId}
            onFileSelect={({ fileId }) => {
              const entry = fileEntries.find((f) => f.id === fileId);
              if (entry) onOpenFile(entry);
            }}
            onFileDragStart={(e, { fileId }) => {
              const entry = fileEntries.find((f) => f.id === fileId);
              if (entry) onFileDragStart(e, entry);
            }}
            consumeFileDragEnd={consumeFileDragEnd}
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
