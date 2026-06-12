import { getPath } from "runtime:app";
import { exists, mkdir, readTextFile, writeTextFile } from "runtime:fs";
import {
  EMPTY_SESSION,
  parseSessionJson,
  serializeSession,
  type BibleEditSession,
} from "./session-format.js";

const SESSION_FILE = "session.json";

export type { BibleEditSession } from "./session-format.js";

export async function sessionFilePath(): Promise<string> {
  const appData = await getPath("appData");
  return `${appData}/${SESSION_FILE}`;
}

export async function loadSession(): Promise<BibleEditSession> {
  const path = await sessionFilePath();
  try {
    if (!(await exists(path))) return EMPTY_SESSION;
    return parseSessionJson(await readTextFile(path));
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
  await writeTextFile(path, serializeSession(session));
}

export async function settingsFilePath(): Promise<string> {
  const appData = await getPath("appData");
  return `${appData}/settings.json`;
}
