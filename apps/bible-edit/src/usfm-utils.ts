export const USFM_SUFFIX = ".usfm";
export const SAMPLE_CORPUS = "./bibles/bsb/usfm";

/** Display label for a folder path (basename, trailing slashes trimmed). */
export function folderLabel(folderPath: string): string {
  const trimmed = folderPath.replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export function isUsfmFile(name: string): boolean {
  return name.toLowerCase().endsWith(USFM_SUFFIX);
}

export function usfmFileId(folderPath: string, fileName: string): string {
  return `${folderPath}/${fileName}`;
}

/** True when `fileId` refers to a file directly inside `folderPath`. */
export function isFileInFolder(folderPath: string, fileId: string): boolean {
  return fileId.startsWith(`${folderPath}/`);
}

export interface UsfmDirEntry {
  readonly name: string;
  readonly isFile: boolean;
}

export interface UsfmFileListEntry {
  readonly id: string;
  readonly name: string;
}

/** Build sorted shell file entries from a directory listing. */
export function listUsfmEntries(
  folderPath: string,
  entries: readonly UsfmDirEntry[],
): readonly UsfmFileListEntry[] {
  return entries
    .filter((entry) => entry.isFile && isUsfmFile(entry.name))
    .map((entry) => ({ id: usfmFileId(folderPath, entry.name), name: entry.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
