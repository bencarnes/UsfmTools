import React, { useMemo, type CSSProperties } from "react";
import { themedControlButton, themedControlDivider } from "../../theme-tokens.js";
import {
  buildUsfmFilePickerGroups,
  type UsfmFilePickerFile,
  type UsfmFilePickerFileInput,
} from "@usfm-tools/model";

export interface UsfmFilePickerSelectDetail {
  readonly fileId: string;
  /** Empty when the file has no `\\id` or an empty `\\id` line. */
  readonly code: string;
}

export interface UsfmFilePickerProps {
  /** One USFM file per entry; filesystem paths are not read here. */
  readonly files: readonly UsfmFilePickerFileInput[];
  /** Highlights the active file when set. */
  readonly activeFileId?: string | null;
  /** Fired when the user activates a file (click or keyboard on the button). */
  readonly onFileSelect?: (detail: UsfmFilePickerSelectDetail) => void;
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
  borderColor: "var(--usfm-accent-border, #93c5fd)",
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
  fileTestIdPrefix,
}: {
  readonly files: readonly UsfmFilePickerFile[];
  readonly activeFileId?: string | null;
  readonly onFileSelect?: (detail: UsfmFilePickerSelectDetail) => void;
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
              onClick={() => onFileSelect?.({ fileId: file.fileId, code: file.code })}
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
 * the same standard `\\id` each appear separately, distinguished by file name.
 */
export function UsfmFilePicker({
  files,
  activeFileId,
  onFileSelect,
  fileTestIdPrefix,
  className,
}: UsfmFilePickerProps): React.JSX.Element {
  const groups = useMemo(() => buildUsfmFilePickerGroups(files), [files]);

  const showOld = groups.oldTestament.length > 0;
  const showNew = groups.newTestament.length > 0;
  const showOther = groups.other.length > 0;
  const showNonStandard = groups.nonStandard.length > 0;

  return (
    <div
      className={`usfm-file-picker-root ${className ?? ""}`.trim()}
      style={{ width: "100%", boxSizing: "border-box" }}
    >
      {showOld ? (
        <VerticalFileList
          files={groups.oldTestament}
          activeFileId={activeFileId}
          onFileSelect={onFileSelect}
          fileTestIdPrefix={fileTestIdPrefix}
        />
      ) : null}
      {showNew ? (
        <>
          {showOld ? <hr style={dividerStyle} aria-hidden /> : null}
          <VerticalFileList
            files={groups.newTestament}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            fileTestIdPrefix={fileTestIdPrefix}
          />
        </>
      ) : null}
      {showOther ? (
        <>
          {showOld || showNew ? <hr style={dividerStyle} aria-hidden /> : null}
          <VerticalFileList
            files={groups.other}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            fileTestIdPrefix={fileTestIdPrefix}
          />
        </>
      ) : null}
      {showNonStandard ? (
        <>
          {showOld || showNew || showOther ? <hr style={dividerStyle} aria-hidden /> : null}
          <VerticalFileList
            files={groups.nonStandard}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            fileTestIdPrefix={fileTestIdPrefix}
          />
        </>
      ) : null}
    </div>
  );
}
