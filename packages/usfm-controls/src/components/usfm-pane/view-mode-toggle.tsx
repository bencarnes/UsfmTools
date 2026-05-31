import type { CSSProperties, ReactNode } from "react";

export type UsfmPaneViewMode = "edit" | "preview" | "split";

export const VIEW_MODE_ORDER: readonly UsfmPaneViewMode[] = ["edit", "preview", "split"];

export const VIEW_MODE_LABELS: Record<UsfmPaneViewMode, string> = {
  edit: "Edit",
  preview: "Preview",
  split: "Edit + Preview",
};

export function nextViewMode(current: UsfmPaneViewMode): UsfmPaneViewMode {
  const i = VIEW_MODE_ORDER.indexOf(current);
  return VIEW_MODE_ORDER[(i + 1) % VIEW_MODE_ORDER.length]!;
}

const iconSvgProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  "aria-hidden": true as const,
  className: "block",
};

/** Eye icon — indicates switching to Preview. */
export function IconPreviewEye() {
  return (
    <svg {...iconSvgProps}>
      <ellipse
        cx="9"
        cy="9"
        rx="6.5"
        ry="4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="9" cy="9" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** Document with pencil — indicates switching to Edit. */
export function IconEditDocument() {
  return (
    <svg {...iconSvgProps}>
      <path
        d="M4.5 2.5h6.2L13.5 5.8V14a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M10.5 2.5V6h3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path
        d="M11.2 10.2l3.1 3.1-1.4 1.4-3.1-3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 11.6l1.4-1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const splitIconBox = { width: 9, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center" } as const;

/** Eye and document icons together — indicates switching to Edit + Preview. */
export function IconEditPreviewSplit() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }} aria-hidden>
      <span style={splitIconBox}>
        <svg width={9} height={9} viewBox="0 0 18 18" className="block">
          <ellipse
            cx="9"
            cy="9"
            rx="6.5"
            ry="4.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="9" cy="9" r="2.25" fill="currentColor" />
        </svg>
      </span>
      <span style={splitIconBox}>
        <svg width={9} height={9} viewBox="0 0 18 18" className="block">
          <path
            d="M4.5 2.5h6.2L13.5 5.8V14a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path
            d="M11.2 10.2l3.1 3.1-1.4 1.4-3.1-3.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}

export function viewModeNextIcon(mode: UsfmPaneViewMode): ReactNode {
  switch (mode) {
    case "preview":
      return <IconPreviewEye />;
    case "edit":
      return <IconEditDocument />;
    case "split":
      return <IconEditPreviewSplit />;
  }
}

export interface ViewModeCycleButtonProps {
  readonly viewMode: UsfmPaneViewMode;
  readonly onCycle: () => void;
  readonly buttonStyle: CSSProperties;
}

/** Single toolbar control that cycles edit → preview → split; icon shows the next mode. */
export function ViewModeCycleButton({ viewMode, onCycle, buttonStyle }: ViewModeCycleButtonProps) {
  const nextMode = nextViewMode(viewMode);
  const nextLabel = VIEW_MODE_LABELS[nextMode];
  const currentLabel = VIEW_MODE_LABELS[viewMode];

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextLabel} view`}
      title={`${currentLabel} — click for ${nextLabel}`}
      style={{
        ...buttonStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "2rem",
        padding: "0.25rem 0.4rem",
      }}
      onClick={onCycle}
    >
      {viewModeNextIcon(nextMode)}
    </button>
  );
}
