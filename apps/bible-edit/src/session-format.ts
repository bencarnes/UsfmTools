export interface BibleEditSession {
  /** Absolute path to the folder whose `*.usfm` files populate the shell. */
  readonly usfmFolder: string | null;
}

export const EMPTY_SESSION: BibleEditSession = { usfmFolder: null };

export function parseSessionJson(content: string): BibleEditSession {
  const parsed = JSON.parse(content) as Partial<BibleEditSession>;
  return {
    usfmFolder: typeof parsed.usfmFolder === "string" ? parsed.usfmFolder : null,
  };
}

export function serializeSession(session: BibleEditSession): string {
  return JSON.stringify(session, null, 2);
}
