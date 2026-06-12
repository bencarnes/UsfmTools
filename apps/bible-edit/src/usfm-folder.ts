import { getPath } from "runtime:app";
import { exists, mkdir, readDir, readTextFile, type DirEntry } from "runtime:fs";
import type { UsfmShellFileEntry } from "@usfm-tools/controls";
import { loadSession, saveSession } from "./session.js";

const USFM_SUFFIX = ".usfm";
const SAMPLE_CORPUS = "./bibles/bsb/usfm";

function folderLabel(folderPath: string): string {
  const trimmed = folderPath.replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function isUsfmFile(name: string): boolean {
  return name.toLowerCase().endsWith(USFM_SUFFIX);
}

export async function resolveInitialUsfmFolder(): Promise<string | null> {
  const session = await loadSession();
  if (session.usfmFolder && (await exists(session.usfmFolder))) {
    return session.usfmFolder;
  }

  if (await exists(SAMPLE_CORPUS)) {
    return SAMPLE_CORPUS;
  }

  const appData = await getPath("appData");
  const library = `${appData}/usfm`;
  if (!(await exists(library))) {
    await mkdir(library, { recursive: true });
  }
  return library;
}

export class UsfmFolderHost {
  #folderPath: string | null = null;
  #label = "No USFM folder";

  get label(): string {
    return this.#label;
  }

  get folderPath(): string | null {
    return this.#folderPath;
  }

  async initialize(): Promise<void> {
    this.#folderPath = await resolveInitialUsfmFolder();
    this.#label = this.#folderPath ? folderLabel(this.#folderPath) : "No USFM folder";
    await saveSession({ usfmFolder: this.#folderPath });
  }

  async setFolder(folderPath: string): Promise<void> {
    if (!(await exists(folderPath))) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }
    this.#folderPath = folderPath;
    this.#label = folderLabel(folderPath);
    await saveSession({ usfmFolder: folderPath });
  }

  async listFiles(): Promise<readonly UsfmShellFileEntry[]> {
    if (!this.#folderPath) return [];
    const entries = await readDir(this.#folderPath);
    return entries
      .filter((entry: DirEntry) => entry.isFile && isUsfmFile(entry.name))
      .map((entry: DirEntry) => ({
        id: `${this.#folderPath}/${entry.name}`,
        name: entry.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async readFile(fileId: string): Promise<string | null> {
    if (!this.#folderPath || !fileId.startsWith(`${this.#folderPath}/`)) {
      return null;
    }
    try {
      return await readTextFile(fileId);
    } catch {
      return null;
    }
  }
}
