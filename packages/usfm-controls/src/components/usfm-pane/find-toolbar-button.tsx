import type { CSSProperties } from "react";

/** Magnifying glass — opens the editor find bar. */
export function IconFind() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="block">
      <circle
        cx="7.5"
        cy="7.5"
        r="4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        d="M10.75 10.75 14.5 14.5"
      />
    </svg>
  );
}

export interface FindToolbarButtonProps {
  readonly disabled: boolean;
  readonly buttonStyle: CSSProperties;
  readonly onOpenFind: () => void;
}

export function FindToolbarButton({ disabled, buttonStyle, onOpenFind }: FindToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label="Find in document"
      title={disabled ? "Switch to edit or split view to search" : "Find (Ctrl+F)"}
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
      onClick={onOpenFind}
    >
      <IconFind />
    </button>
  );
}
