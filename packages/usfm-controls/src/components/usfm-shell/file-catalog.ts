import {
  buildUsfmFilePickerGroups,
  scanUsfmPickerHeaderFromText,
  type UsfmFilePickerGroups,
} from "@usfm-tools/model";
import type { UsfmShellFileEntry, UsfmShellHost } from "./host.js";

type FileCatalogHost = Pick<UsfmShellHost, "readFile"> &
  Partial<Pick<UsfmShellHost, "readFilePickerHeader">>;

export const EMPTY_FILE_CATALOG: UsfmFilePickerGroups = {
  oldTestament: [],
  newTestament: [],
  other: [],
  nonStandard: [],
};

async function readPickerHeaderUsfm(
  fileId: string,
  host: FileCatalogHost,
): Promise<string> {
  if (host.readFilePickerHeader) {
    return (await host.readFilePickerHeader(fileId)) ?? "";
  }
  const full = await host.readFile(fileId);
  if (full == null) return "";
  return scanUsfmPickerHeaderFromText(full).headerUsfm;
}

/**
 * Index each file for the sidebar picker by reading only pre-chapter metadata (`\id`,
 * `\toc*`, and related header markers), stopping before the first `\c` chapter line.
 * Full USFM bodies are not retained — only grouped picker rows.
 */
export async function buildUsfmFilePickerCatalog(
  entries: readonly UsfmShellFileEntry[],
  host: FileCatalogHost,
): Promise<UsfmFilePickerGroups> {
  if (entries.length === 0) return EMPTY_FILE_CATALOG;
  const inputs = await Promise.all(
    entries.map(async (entry) => ({
      id: entry.id,
      name: entry.name,
      usfm: await readPickerHeaderUsfm(entry.id, host),
    })),
  );
  return buildUsfmFilePickerGroups(inputs);
}
