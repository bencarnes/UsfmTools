import type { Meta, StoryObj } from "@storybook/react";
import { withSystemTheme } from "../../../.storybook/with-theme-decorator.js";
import { UsfmEditor } from "./UsfmEditor.js";

const meta = {
  title: "Controls/UsfmEditor",
  component: UsfmEditor,
  decorators: [withSystemTheme],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "USFM source editor. Press **Ctrl+F** for find or **Ctrl+H** for find and replace (upper-right panel).",
      },
    },
  },
  argTypes: {
    value: { control: "text" },
    className: { control: "text" },
  },
} satisfies Meta<typeof UsfmEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_GENESIS = `\\id GEN Berean Standard Bible
\\h Genesis
\\toc1 Genesis
\\toc2 Genesis
\\toc3 Gen
\\mt2 Genesis
\\mt1
\\c 1
\\s1 The Creation
\\r (\\ref John 1:1–5|JHN 1:1-5\\ref*; \\ref Hebrews 11:1–3|HEB 11:1-3\\ref*)
\\p \\v 1 In the beginning God created the heavens and the earth.
\\p \\v 2 Now the earth was formless and void, and darkness was over the surface of the deep. And the Spirit of God was hovering over the surface of the waters.
\\s2 The First Day
\\pmo \\v 3 And God said, "Let there be light,"\\f + \\fr 1:3 \\ft Cited in \\ref 2 Corinthians 4:6|2CO 4:6\\ref*\\f* and there was light. \\v 4 And God saw that the light was good, and He separated the light from the darkness. \\v 5 God called the light "day," and the darkness He called "night."
\\pmo And there was evening, and there was morning — the first day.`;

const SAMPLE_PSALM = `\\id PSA
\\c 1
\\s1 The Two Paths
\\q1 \\v 1 Blessed is the man
\\q2 who does not walk in the counsel of the wicked,
\\q1 or set foot on the path of sinners,
\\q2 or sit in the seat of mockers.
\\q1 \\v 2 But his delight is in the Law of the \\nd Lord\\nd*,
\\q2 and on His law he meditates day and night.
\\b
\\q1 \\v 3 He is like a tree planted by streams of water,
\\q2 yielding its fruit in season,
\\q1 whose leaf does not wither,
\\q2 and who prospers in all he does.`;

export const Genesis: Story = {
  args: {
    value: SAMPLE_GENESIS,
    className: "h-[500px]",
  },
};

export const Psalm: Story = {
  args: {
    value: SAMPLE_PSALM,
    className: "h-[400px]",
  },
};

export const Empty: Story = {
  args: {
    value: "",
    className: "h-[300px]",
  },
};

export const WithErrors: Story = {
  args: {
    value: `\\id GEN
\\c 1
\\p
\\v 1 In the beginning \\zzz unknown marker \\nd Lord\\nd* created.
\\v 2 Text with \\bk* orphaned end marker.`,
    className: "h-[300px]",
  },
};
