import type { Meta, StoryObj } from "@storybook/react";
import type { BookNode } from "@usfm-tools/parser";
import { parse } from "@usfm-tools/parser";
import { withSystemTheme } from "../../../.storybook/with-theme-decorator.js";
import { ChapterPicker } from "./ChapterPicker.js";

function bookFromUsfm(usfm: string): BookNode {
  const { document } = parse(usfm);
  const book = document.children.find((c) => c.type === "book") as BookNode | undefined;
  if (!book) {
    throw new Error("Story USFM must contain a \\id book");
  }
  return book;
}

const meta: Meta<typeof ChapterPicker> = {
  title: "Controls/ChapterPicker",
  component: ChapterPicker,
  decorators: [
    withSystemTheme,
    (Story) => (
      <div style={{ maxWidth: 320, border: "1px solid #ccc", padding: "0.75rem", borderRadius: 6 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ChapterPicker>;

export const Psalm150: Story = {
  args: {
    book: bookFromUsfm("\\id PSA\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1\n\\c 150\n\\p\n\\v 1"),
  },
};

export const OutOfOrderAndDuplicates: Story = {
  args: {
    book: bookFromUsfm("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1\n\\c 10\n\\p\n\\v 1"),
  },
};

export const ArabicIndicNumerals: Story = {
  args: {
    book: bookFromUsfm("\\id GEN\n\\c ١\n\\p\n\\v 1\n\\c ٢\n\\p\n\\v 1"),
  },
};

export const Empty: Story = {
  args: {
    book: bookFromUsfm("\\id FRT\n\\p\n\\v 1 Front only."),
  },
};
