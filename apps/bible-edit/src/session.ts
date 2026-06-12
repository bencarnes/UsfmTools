import { getPath } from "runtime:app";
import { exists, mkdir, readTextFile, writeTextFile } from "runtime:fs";

const SESSION_FILE = "session.json";

export interface BibleEditSession {
  /** Absolute path to the folder whose `*.usfm` files populate the shell. */
  readonly usfmFolder: string | null;
}

const EMPTY_SESSION: BibleEditSession = { usfmFolder: null };

export async function sessionFilePath(): Promise<string> {
  const appData = await getPath("appData");
  return `${appData}/${SESSION_FILE}`;
}

export async function loadSession(): Promise<BibleEditSession> {
  const path = await sessionFilePath();
  try {
    if (!(await exists(path))) return EMPTY_SESSION;
    const parsed = JSON.parse(await readTextFile(path)) as Partial<BibleEditSession>;
    return {
      usfmFolder: typeof parsed.usfmFolder === "string" ? parsed.usfmFolder : null,
    };
  } catch (error) {
    console.warn("Failed to load session; using defaults.", error);
    return EMPTY_SESSION;
  }
}

export async function saveSession(session: BibleEditSession): Promise<void> {
  const path = await sessionFilePath();
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  await writeTextFile(path, JSON.stringify(session, null, 2));
}

export async function settingsFilePath(): Promise<string> {
  const appData = await getPath("appData");
  return `${appData}/settings.json`;
}
