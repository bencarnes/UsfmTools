import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";
import {
  STANDARD_USFM_BOOK_IDENTIFIERS,
  type UsfmFilePickerFileInput,
} from "@usfm-tools/model";
import { UsfmFilePicker } from "./UsfmFilePicker.js";

function minimalOtNtUsfm(code: string): string {
  return `\\id ${code}
\\toc3 ${code}
\\c 1
\\p
`;
}

const OT_NT_FILES: readonly UsfmFilePickerFileInput[] =
  STANDARD_USFM_BOOK_IDENTIFIERS.filter(
    (b) => b.canonGroup === "ot" || b.canonGroup === "nt",
  ).map((b) => ({
    id: b.code,
    name: `${b.code}.usfm`,
    usfm: minimalOtNtUsfm(b.code),
  }));

const OTHER_SAMPLE_FILES: readonly UsfmFilePickerFileInput[] = [
  {
    id: "frt",
    name: "FRT.usfm",
    usfm: `\\id FRT
\\toc1 Front Matter
\\c 1
\\p
`,
  },
  {
    id: "bak",
    name: "BAK.usfm",
    usfm: `\\id BAK
\\toc1 Back Matter
\\c 1
\\p
`,
  },
  {
    id: "glo",
    name: "GLO.usfm",
    usfm: `\\id GLO
\\toc1 Glossary
\\c 1
\\p
`,
  },
];

const HYMNAL_FILE: UsfmFilePickerFileInput = {
  id: "hymnal",
  name: "hymnal.usfm",
  usfm: `\\id HYM
\\toc1 Hymnal
\\c 1
\\p
`,
};

const NO_ID_SAMPLE: UsfmFilePickerFileInput = {
  id: "music-supplement",
  name: "music-supplement.usfm",
  usfm: `\\toc1 Music supplement
\\c 1
\\p
`,
};

const SAMPLE_FILES: readonly UsfmFilePickerFileInput[] = [
  ...OT_NT_FILES,
  ...OTHER_SAMPLE_FILES,
  HYMNAL_FILE,
  NO_ID_SAMPLE,
];

export default {
  title: "Controls/UsfmFilePicker",
} satisfies StoryDefault;

export const Default: Story = () => {
  const [last, setLast] = useState<string>("(none)");
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="max-w-md space-y-3">
      <UsfmFilePicker
        files={SAMPLE_FILES}
        activeFileId={active}
        onFileSelect={(d) => {
          setActive(d.fileId);
          setLast(`${d.code || "(no id)"} → fileId ${d.fileId}`);
        }}
        className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
      />
      <p className="text-sm text-gray-600 dark:text-gray-400">Last selection: {last}</p>
    </div>
  );
};
