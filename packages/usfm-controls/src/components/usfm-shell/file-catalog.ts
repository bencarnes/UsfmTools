import { buildUsfmFilePickerGroups, type UsfmFilePickerGroups } from "@usfm-tools/model";
import type { UsfmShellFileEntry } from "./host.js";

export const EMPTY_FILE_CATALOG: UsfmFilePickerGroups = {
  oldTestament: [],
  newTestament: [],
  other: [],
  nonStandard: [],
};

/**
 * Read each file once to build sidebar picker groups. Full USFM bodies are not retained —
 * only the grouped picker rows needed for the file browser.
 */
export async function buildUsfmFilePickerCatalog(
  entries: readonly UsfmShellFileEntry[],
  readFile: (fileId: string) => Promise<string | null>,
): Promise<UsfmFilePickerGroups> {
  if (entries.length === 0) return EMPTY_FILE_CATALOG;
  const inputs = await Promise.all(
    entries.map(async (entry) => ({
      id: entry.id,
      name: entry.name,
      usfm: (await readFile(entry.id)) ?? "",
    })),
  );
  return buildUsfmFilePickerGroups(inputs);
}
