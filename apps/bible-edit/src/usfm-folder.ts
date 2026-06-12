import { getPath } from "runtime:app";
import { exists, mkdir, readDir, readTextFile } from "runtime:fs";
import type { UsfmShellFileEntry } from "@usfm-tools/controls";
import { resolveInitialFolderPath } from "./resolve-initial-folder.js";
import { loadSession, saveSession } from "./session.js";
import {
  folderLabel,
  isFileInFolder,
  listUsfmEntries,
  SAMPLE_CORPUS,
} from "./usfm-utils.js";

export async function resolveInitialUsfmFolder(): Promise<string | null> {
  const session = await loadSession();
  const appData = await getPath("appData");
  const library = `${appData}/usfm`;

  const folderPath = resolveInitialFolderPath({
    sessionFolder: session.usfmFolder,
    sessionFolderExists: session.usfmFolder ? await exists(session.usfmFolder) : false,
    sampleCorpusExists: await exists(SAMPLE_CORPUS),
    sampleCorpusPath: SAMPLE_CORPUS,
    appDataLibraryPath: library,
  });

  if (folderPath === library && !(await exists(library))) {
    await mkdir(library, { recursive: true });
  }

  return folderPath;
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
    return listUsfmEntries(this.#folderPath, entries);
  }

  async readFile(fileId: string): Promise<string | null> {
    if (!this.#folderPath || !isFileInFolder(this.#folderPath, fileId)) {
      return null;
    }
    try {
      return await readTextFile(fileId);
    } catch {
      return null;
    }
  }
}
