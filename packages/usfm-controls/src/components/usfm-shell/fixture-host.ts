import { SAMPLE_BSB_GENESIS_USFM, SAMPLE_EXO_SNIPPET_USFM } from "../../fixtures/sample-bsb-genesis-usfm.js";
import type { UsfmShellFileEntry, UsfmShellHost } from "./host.js";

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

const DEFAULT_FILES: readonly FixtureFile[] = [
  { entry: { id: "fake://bible/GEN.usfm", name: "GEN.usfm" }, usfm: SAMPLE_BSB_GENESIS_USFM },
  { entry: { id: "fake://bible/EXO.usfm", name: "EXO.usfm" }, usfm: SAMPLE_EXO_SNIPPET_USFM },
  { entry: { id: "fake://bible/LEV.usfm", name: "LEV.usfm" }, usfm: LEV_USFM },
  { entry: { id: "fake://bible/NUM.usfm", name: "NUM.usfm" }, usfm: NUM_USFM },
  { entry: { id: "fake://bible/PSA.usfm", name: "PSA.usfm" }, usfm: PSA_BAD_USFM },
];

export interface FixtureUsfmShellHostOptions {
  readonly label?: string;
  readonly files?: readonly FixtureFile[];
}

/**
 * In-memory host implementation. Returned promises resolve synchronously on a
 * microtask so callers exercise the async path. Intended for Storybook and tests.
 */
export function createFixtureUsfmShellHost(options: FixtureUsfmShellHostOptions = {}): UsfmShellHost {
  const files = options.files ?? DEFAULT_FILES;
  const byId = new Map(files.map((f) => [f.entry.id, f.usfm] as const));
  return {
    label: options.label ?? "Sample bible folder",
    async listFiles() {
      return files.map((f) => f.entry);
    },
    async readFile(id: string) {
      return byId.get(id) ?? null;
    },
  };
}
