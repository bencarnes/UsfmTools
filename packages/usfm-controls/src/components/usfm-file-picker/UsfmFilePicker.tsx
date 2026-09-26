import React, { useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { themedControlButton, themedControlDivider } from "../../theme-tokens.js";
import {
  buildUsfmFilePickerGroups,
  type UsfmFilePickerFile,
  type UsfmFilePickerFileInput,
  type UsfmFilePickerGroups,
} from "@usfm-tools/model";

export interface UsfmFilePickerSelectDetail {
  readonly fileId: string;
  /** Empty when the file has no `\\id` or an empty `\\id` line. */
  readonly code: string;
}

export interface UsfmFilePickerProps {
  /**
   * One USFM file per entry; filesystem paths are not read here.
   * Supply either `files` (parsed on the client) or pre-built `groups`.
   */
  readonly files?: readonly UsfmFilePickerFileInput[];
  /** Pre-built picker groups (for example from a one-time folder index). */
  readonly groups?: UsfmFilePickerGroups;
  /** Highlights the active file when set. */
  readonly activeFileId?: string | null;
  /** Fired when the user activates a file (click or keyboard on the button). */
  readonly onFileSelect?: (detail: UsfmFilePickerSelectDetail) => void;
  /**
   * Begin a pointer-based drag of a file row (for example to drop it into a workspace tab group).
   * Fired on `pointerdown`; the consumer decides when the movement passes a drag threshold.
   */
  readonly onFileDragStart?: (e: ReactPointerEvent, detail: UsfmFilePickerSelectDetail) => void;
  /**
   * Returns true when the click that follows a drag should be swallowed (so a drag does not also
   * open the file in place). Mirrors the workspace tab-drag click suppression.
   */
  readonly consumeFileDragEnd?: () => boolean;
  /**
   * Optional prefix for `data-testid` on each file button (`${prefix}-${name}`).
   * Omit to skip test ids.
   */
  readonly fileTestIdPrefix?: string;
  readonly className?: string;
}

const fileButtonBase: CSSProperties = {
  ...themedControlButton,
  width: "100%",
  minHeight: "2rem",
  padding: "0.35rem 0.5rem",
  boxSizing: "border-box",
  cursor: "pointer",
  borderRadius: "4px",
  fontFamily: "inherit",
  fontSize: "0.95rem",
  textAlign: "left",
};

const activeFileButton: CSSProperties = {
  background: "var(--usfm-accent-bg, #dbeafe)",
  color: "var(--usfm-accent-fg, #1e3a8a)",
  border: "2px solid var(--usfm-accent-fg, #1e3a8a)",
};

const dividerStyle: CSSProperties = themedControlDivider;

function pickerButtonTitle(file: UsfmFilePickerFile): string {
  if (file.code) return `${file.displayLabel} (${file.code})`;
  return file.displayLabel;
}

function pickerButtonAriaLabel(file: UsfmFilePickerFile): string {
  if (file.code) {
    return `Open ${file.displayLabel} (${file.code})`;
  }
  return `Open ${file.displayLabel}`;
}

function VerticalFileList({
  files,
  activeFileId,
  onFileSelect,
  onFileDragStart,
  consumeFileDragEnd,
  fileTestIdPrefix,
}: {
  readonly files: readonly UsfmFilePickerFile[];
  readonly activeFileId?: string | null;
  readonly onFileSelect?: (detail: UsfmFilePickerSelectDetail) => void;
  readonly onFileDragStart?: (e: ReactPointerEvent, detail: UsfmFilePickerSelectDetail) => void;
  readonly consumeFileDragEnd?: () => boolean;
  readonly fileTestIdPrefix?: string;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        width: "100%",
      }}
    >
      {files.map((file) => {
        const active = activeFileId != null && file.fileId === activeFileId;
        return (
          <li key={file.fileId} style={{ width: "100%" }}>
            <button
              type="button"
              style={{
                ...fileButtonBase,
                ...(active ? activeFileButton : null),
              }}
              title={pickerButtonTitle(file)}
              aria-label={pickerButtonAriaLabel(file)}
              aria-current={active ? "true" : undefined}
              data-testid={
                fileTestIdPrefix ? `${fileTestIdPrefix}-${file.displayLabel}` : undefined
              }
              onPointerDown={
                onFileDragStart
                  ? (e) => onFileDragStart(e, { fileId: file.fileId, code: file.code })
                  : undefined
              }
              onClick={() => {
                if (consumeFileDragEnd?.()) return;
                onFileSelect?.({ fileId: file.fileId, code: file.code });
              }}
            >
              {file.displayLabel}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Picker for USFM files: reads `\\id` from supplied file contents (no filesystem access),
 * groups Old Testament, New Testament, other standard identifiers, and non-standard entries,
 * orders standard books by the official USFM book table, and shows each file name in a
 * vertical list. Table-of-contents markers are ignored for labels; multiple files sharing
 * the same standard `\\id` each appear separately, distinguished by file name. Within a
 * group, rows sort by book table order, then file name when the table index ties.
 */
export function UsfmFilePicker({
  files,
  groups,
  activeFileId,
  onFileSelect,
  onFileDragStart,
  consumeFileDragEnd,
  fileTestIdPrefix,
  className,
}: UsfmFilePickerProps): React.JSX.Element {
  const resolvedGroups = useMemo(() => {
    if (groups) return groups;
    return buildUsfmFilePickerGroups(files ?? []);
  }, [groups, files]);

  const showOld = resolvedGroups.oldTestament.length > 0;
  const showNew = resolvedGroups.newTestament.length > 0;
  const showOther = resolvedGroups.other.length > 0;
  const showNonStandard = resolvedGroups.nonStandard.length > 0;

  return (
    <div
      className={`usfm-file-picker-root ${className ?? ""}`.trim()}
      style={{ width: "100%", boxSizing: "border-box" }}
    >
      {showOld ? (
        <VerticalFileList
          files={resolvedGroups.oldTestament}
          activeFileId={activeFileId}
          onFileSelect={onFileSelect}
          onFileDragStart={onFileDragStart}
          consumeFileDragEnd={consumeFileDragEnd}
          fileTestIdPrefix={fileTestIdPrefix}
        />
      ) : null}
      {showNew ? (
        <>
          {showOld ? <hr style={dividerStyle} aria-hidden /> : null}
          <VerticalFileList
            files={resolvedGroups.newTestament}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            onFileDragStart={onFileDragStart}
            consumeFileDragEnd={consumeFileDragEnd}
            fileTestIdPrefix={fileTestIdPrefix}
          />
        </>
      ) : null}
      {showOther ? (
        <>
          {showOld || showNew ? <hr style={dividerStyle} aria-hidden /> : null}
          <VerticalFileList
            files={resolvedGroups.other}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            onFileDragStart={onFileDragStart}
            consumeFileDragEnd={consumeFileDragEnd}
            fileTestIdPrefix={fileTestIdPrefix}
          />
        </>
      ) : null}
      {showNonStandard ? (
        <>
          {showOld || showNew || showOther ? <hr style={dividerStyle} aria-hidden /> : null}
          <VerticalFileList
            files={resolvedGroups.nonStandard}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            onFileDragStart={onFileDragStart}
            consumeFileDragEnd={consumeFileDragEnd}
            fileTestIdPrefix={fileTestIdPrefix}
          />
        </>
      ) : null}
    </div>
  );
}
