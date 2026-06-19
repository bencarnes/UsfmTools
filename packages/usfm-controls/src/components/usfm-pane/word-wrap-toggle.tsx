import type { CSSProperties } from "react";

/** Wrapping-arrow lines — represents soft word wrap. */
export function IconWordWrap() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="block">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4h12M3 9h9a2.5 2.5 0 0 1 0 5h-2.5M3 14h2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 12.5 5.5 14 7 15.5"
      />
    </svg>
  );
}

export interface WordWrapToggleButtonProps {
  readonly wordWrapEnabled: boolean;
  readonly onToggle: () => void;
  readonly buttonStyle: CSSProperties;
}

export function WordWrapToggleButton({
  wordWrapEnabled,
  onToggle,
  buttonStyle,
}: WordWrapToggleButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={wordWrapEnabled}
      aria-label="word wrap"
      title="word wrap"
      style={{
        ...buttonStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "2rem",
        padding: "0.25rem 0.4rem",
        fontWeight: wordWrapEnabled ? 700 : 400,
      }}
      onClick={onToggle}
    >
      <IconWordWrap />
    </button>
  );
}
