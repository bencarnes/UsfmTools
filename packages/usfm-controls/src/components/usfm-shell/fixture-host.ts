import { scanUsfmPickerHeaderFromText } from "@usfm-tools/model";
import { SAMPLE_BSB_GENESIS_USFM, SAMPLE_EXO_SNIPPET_USFM } from "../../fixtures/sample-bsb-genesis-usfm.js";
import type { ApplicationSettings } from "../settings-pane/settings-model.js";
import type { UsfmShellFileEntry, UsfmShellHost, UsfmShellRecentFolder } from "./host.js";

const LEV_USFM = `\\id LEV
\\c 1
\\p
\\v 1 The LORD called Moses and spoke to him from the tent of meeting.
\\v 2 He said, "Speak to the Israelites and say to them: 'When anyone among you brings an offering to the LORD, you may bring as your offering an animal from the herd or flock.'"
\\c 2
\\p
\\v 1 "When anyone brings a grain offering to the LORD, the offering must consist of the finest flour."
`;

const NUM_USFM = `\\id NUM
\\c 1
\\p
\\v 1 The LORD spoke to Moses in the tent of meeting in the Wilderness of Sinai.
\\v 2 "Take a census of the whole Israelite community by their clans and families, listing every man by name, one by one."
`;

// One file with an intentional unknown marker so the errors tab has something to show.
const PSA_BAD_USFM = `\\id PSA
\\c 1
\\p
\\v 1 Blessed is the one who does not walk in step with the wicked.
\\xyz this marker does not exist
\\v 2 But whose delight is in the law of the LORD.
`;

interface FixtureFile {
  readonly entry: UsfmShellFileEntry;
  readonly usfm: string;
}

interface FixtureFolder {
  readonly path: string;
  readonly label: string;
  readonly files: readonly FixtureFile[];
}

const DEFAULT_FOLDERS: readonly FixtureFolder[] = [
  {
    path: "/fake/bible/sample",
    label: "Sample bible folder",
    files: [
      { entry: { id: "fake://bible/GEN.usfm", name: "GEN.usfm" }, usfm: SAMPLE_BSB_GENESIS_USFM },
      { entry: { id: "fake://bible/EXO.usfm", name: "EXO.usfm" }, usfm: SAMPLE_EXO_SNIPPET_USFM },
      { entry: { id: "fake://bible/LEV.usfm", name: "LEV.usfm" }, usfm: LEV_USFM },
      { entry: { id: "fake://bible/NUM.usfm", name: "NUM.usfm" }, usfm: NUM_USFM },
      { entry: { id: "fake://bible/PSA.usfm", name: "PSA.usfm" }, usfm: PSA_BAD_USFM },
    ],
  },
  {
    path: "/fake/bible/compact",
    label: "Compact bible folder",
    files: [
      { entry: { id: "fake://compact/GEN.usfm", name: "GEN.usfm" }, usfm: SAMPLE_BSB_GENESIS_USFM },
      { entry: { id: "fake://compact/EXO.usfm", name: "EXO.usfm" }, usfm: SAMPLE_EXO_SNIPPET_USFM },
    ],
  },
];

export interface FixtureUsfmShellHostOptions {
  readonly label?: string;
  readonly folderPath?: string;
  readonly files?: readonly FixtureFile[];
  readonly folders?: readonly FixtureFolder[];
  /** Initial persisted settings. Defaults to `null` (the pane then falls back to defaults). */
  readonly settings?: ApplicationSettings;
}

/**
 * In-memory host implementation. Returned promises resolve synchronously on a
 * microtask so callers exercise the async path. Intended for Storybook and tests.
 */
export function createFixtureUsfmShellHost(options: FixtureUsfmShellHostOptions = {}): UsfmShellHost {
  const folders = options.folders ?? DEFAULT_FOLDERS;
  const initialFolder =
    folders.find((f) => f.path === options.folderPath) ??
    (options.files
      ? {
          path: options.folderPath ?? "/fake/bible/custom",
          label: options.label ?? "Sample bible folder",
          files: options.files,
        }
      : folders[0]!);

  let currentFolder: FixtureFolder = initialFolder;
  const recentPaths: string[] = [currentFolder.path];
  const byId = new Map(currentFolder.files.map((f) => [f.entry.id, f.usfm] as const));
  // In-memory settings store; persists for the lifetime of this host instance.
  let settings: ApplicationSettings | null = options.settings ?? null;

  const syncFileIndex = () => {
    byId.clear();
    for (const f of currentFolder.files) {
      byId.set(f.entry.id, f.usfm);
    }
  };

  const rememberFolder = (path: string) => {
    const next = [path, ...recentPaths.filter((p) => p !== path)];
    recentPaths.length = 0;
    recentPaths.push(...next);
  };

  const host: UsfmShellHost = {
    get label() {
      return currentFolder.label;
    },
    get folderPath() {
      return currentFolder.path;
    },
    async listRecentFolders() {
      return recentPaths
        .map((path) => folders.find((f) => f.path === path))
        .filter((f): f is FixtureFolder => f != null)
        .map(
          (f): UsfmShellRecentFolder => ({
            path: f.path,
            label: f.label,
          }),
        );
    },
    async openFolder(path: string) {
      const folder = folders.find((f) => f.path === path);
      if (!folder) return;
      currentFolder = folder;
      syncFileIndex();
      rememberFolder(path);
    },
    async pickFolder() {
      const next = folders.find((f) => f.path !== currentFolder.path) ?? currentFolder;
      currentFolder = next;
      syncFileIndex();
      rememberFolder(next.path);
    },
    async listFiles() {
      return currentFolder.files.map((f) => f.entry);
    },
    async readFile(id: string) {
      return byId.get(id) ?? null;
    },
    async readFilePickerHeader(id: string) {
      const full = byId.get(id);
      if (full == null) return null;
      return scanUsfmPickerHeaderFromText(full).headerUsfm;
    },
    async loadSettings() {
      return settings;
    },
    async saveSettings(next: ApplicationSettings) {
      settings = next;
    },
  };

  return host;
}
