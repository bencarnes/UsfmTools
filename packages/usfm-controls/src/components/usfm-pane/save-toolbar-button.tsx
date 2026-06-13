import type { CSSProperties } from "react";

/** Floppy disk — saves the active document. */
export function IconSave() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="block">
      <rect
        x="3.25"
        y="2.25"
        width="11.5"
        height="13.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        d="M5.5 2.25v4.25h7V2.25"
      />
      <rect
        x="6"
        y="10"
        width="6"
        height="4.75"
        rx="0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export interface SaveToolbarButtonProps {
  readonly disabled: boolean;
  readonly buttonStyle: CSSProperties;
  readonly onSave: () => void;
}

export function SaveToolbarButton({ disabled, buttonStyle, onSave }: SaveToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label="Save"
      title="Save"
      disabled={disabled}
      style={{
        ...buttonStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "2rem",
        padding: "0.25rem 0.4rem",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={onSave}
      data-testid="usfm-pane-save"
    >
      <IconSave />
    </button>
  );
}
