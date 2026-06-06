import type { CSSProperties } from "react";

/** Shared inline control chrome (toolbar buttons, pickers) driven by CSS variables in `styles.css`. */
export const themedControlButton: CSSProperties = {
  border: "1px solid var(--usfm-border)",
  background: "var(--usfm-control-bg)",
  color: "var(--usfm-fg)",
};

export const themedControlDivider: CSSProperties = {
  border: 0,
  borderTop: "1px solid var(--usfm-border-subtle)",
  margin: "0.65rem 0",
};

export const themedPopoverSurface: CSSProperties = {
  background: "var(--usfm-surface)",
  border: "1px solid var(--usfm-border)",
  boxShadow: "var(--usfm-shadow-popover)",
};
