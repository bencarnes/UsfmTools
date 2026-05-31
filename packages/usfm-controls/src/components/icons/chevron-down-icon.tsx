/** Down chevron used on compact toolbar dropdown controls. */
export function ChevronDownIcon() {
  return (
    <svg
      width={16}
      height={10}
      viewBox="0 0 16 10"
      aria-hidden
      className="block"
      style={{ flexShrink: 0, opacity: 0.85 }}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 2.5 8 8 14 2.5"
      />
    </svg>
  );
}
