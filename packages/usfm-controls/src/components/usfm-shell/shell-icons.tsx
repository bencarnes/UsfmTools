import type { ReactNode } from "react";

/**
 * Small inline SVG icons used by {@link UsfmShell}'s sidebar / bottom-bar tabs.
 * Sized to fit a ~24px square button cell.
 */

const SIZE = 18;

function Svg({ children, label }: { readonly children: ReactNode; readonly label?: string }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="block"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Document outline — file browser tab. */
export function DocIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
    </Svg>
  );
}

/** Magnifying glass — search tab. */
export function SearchIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <circle cx={10.5} cy={10.5} r={6.5} />
      <path d="m20 20-4.6-4.6" />
    </Svg>
  );
}

/** Bug — errors tab. */
export function BugIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <ellipse cx={12} cy={13} rx={5} ry={6} />
      <path d="M9 8c0-2 1.3-3 3-3s3 1 3 3" />
      <path d="M4 11h3M4 17h3M17 11h3M17 17h3M12 7v0M12 19v2" />
    </Svg>
  );
}

/** Double chevron (left) — collapse sidebar. */
export function CollapseLeftIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <path d="m13 6-6 6 6 6" />
      <path d="m19 6-6 6 6 6" />
    </Svg>
  );
}

/** Double chevron (right) — expand sidebar. */
export function ExpandRightIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <path d="m5 6 6 6-6 6" />
      <path d="m11 6 6 6-6 6" />
    </Svg>
  );
}

/** Down chevron — collapse bottom bar. */
export function CollapseDownIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

/** Up chevron — expand bottom bar. */
export function ExpandUpIcon({ label }: { readonly label?: string }) {
  return (
    <Svg label={label}>
      <path d="m6 15 6-6 6 6" />
    </Svg>
  );
}
