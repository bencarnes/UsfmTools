import type { CSSProperties } from "react";

export interface IconScrollSyncArrowsProps {
  readonly enabled: boolean;
}

/** Up/down arrows — bolder strokes when scroll sync is on. */
export function IconScrollSyncArrows({ enabled }: IconScrollSyncArrowsProps) {
  const strokeWidth = enabled ? 2 : 1.2;
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="block">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3.5v4M6.5 5.5 9 3.5 11.5 5.5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14.5v-4M6.5 12.5 9 14.5 11.5 12.5"
      />
    </svg>
  );
}

export interface ScrollSyncToggleButtonProps {
  readonly scrollSyncEnabled: boolean;
  readonly hasChapters: boolean;
  readonly onToggle: () => void;
  readonly buttonStyle: CSSProperties;
}

export function ScrollSyncToggleButton({
  scrollSyncEnabled,
  hasChapters,
  onToggle,
  buttonStyle,
}: ScrollSyncToggleButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={scrollSyncEnabled}
      aria-label="Scroll sync between editor and preview"
      disabled={!hasChapters}
      title={
        hasChapters
          ? scrollSyncEnabled
            ? "Split view: editor and preview scroll together"
            : "Split view: scroll independently"
          : "Add \\c chapter markers to enable scroll sync"
      }
      style={{
        ...buttonStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "2rem",
        padding: "0.25rem 0.4rem",
        opacity: hasChapters ? 1 : 0.45,
        cursor: hasChapters ? "pointer" : "not-allowed",
        fontWeight: scrollSyncEnabled ? 700 : 400,
      }}
      onClick={onToggle}
    >
      <IconScrollSyncArrows enabled={scrollSyncEnabled} />
    </button>
  );
}
