import type { Story, StoryDefault, StoryDecorator } from "@ladle/react";
import type { BookNode } from "@usfm-tools/parser";
import { parse } from "@usfm-tools/parser";
import type { ComponentProps } from "react";
import { ChapterPicker } from "./ChapterPicker.js";

type ChapterPickerArgs = ComponentProps<typeof ChapterPicker>;

function bookFromUsfm(usfm: string): BookNode {
  const { document } = parse(usfm);
  const book = document.children.find((c) => c.type === "book") as BookNode | undefined;
  if (!book) {
    throw new Error("Story USFM must contain a \\id book");
  }
  return book;
}

const framed: StoryDecorator = (Story) => (
  <div style={{ maxWidth: 320, border: "1px solid #ccc", padding: "0.75rem", borderRadius: 6 }}>
    <Story />
  </div>
);

export default {
  title: "Controls/ChapterPicker",
  decorators: [framed],
} satisfies StoryDefault;

export const Psalm150: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
Psalm150.args = {
  book: bookFromUsfm("\\id PSA\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1\n\\c 150\n\\p\n\\v 1"),
};

export const OutOfOrderAndDuplicates: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
OutOfOrderAndDuplicates.args = {
  book: bookFromUsfm("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1\n\\c 10\n\\p\n\\v 1"),
};

export const ArabicIndicNumerals: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
ArabicIndicNumerals.args = {
  book: bookFromUsfm("\\id GEN\n\\c ١\n\\p\n\\v 1\n\\c ٢\n\\p\n\\v 1"),
};

export const Empty: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
Empty.args = {
  book: bookFromUsfm("\\id FRT\n\\p\n\\v 1 Front only."),
};
