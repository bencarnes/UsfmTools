import type { CSSProperties } from "react";

/** Numbered lines — represents one preview line per verse. */
export function IconVersePerLine() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="block">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3v2.5M3 8v2.5M3 13v2.5M6.5 4.25h8.5M6.5 9.25h8.5M6.5 14.25h6"
      />
    </svg>
  );
}

export interface VersePerLineToggleButtonProps {
  readonly versePerLineEnabled: boolean;
  /** True when no preview is showing (edit-only view). */
  readonly disabled: boolean;
  readonly onToggle: () => void;
  readonly buttonStyle: CSSProperties;
}

/** Switches the preview to one line per verse, ignoring paragraph breaks. */
export function VersePerLineToggleButton({
  versePerLineEnabled,
  disabled,
  onToggle,
  buttonStyle,
}: VersePerLineToggleButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={versePerLineEnabled}
      aria-label="verse per line"
      title={disabled ? "Switch to preview or split view to lay out verses" : "verse per line"}
      disabled={disabled}
      style={{
        ...buttonStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "2rem",
        padding: "0.25rem 0.4rem",
        fontWeight: versePerLineEnabled ? 700 : 400,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={onToggle}
    >
      <IconVersePerLine />
    </button>
  );
}
