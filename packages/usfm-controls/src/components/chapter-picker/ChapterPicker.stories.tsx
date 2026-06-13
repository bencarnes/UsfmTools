import type { Story, StoryDefault, StoryDecorator } from "@ladle/react";
import type { ComponentProps } from "react";
import { ChapterPicker } from "./ChapterPicker.js";

type ChapterPickerArgs = ComponentProps<typeof ChapterPicker>;

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
  chapterNumbers: ["1", "2", "150"],
};

export const OutOfOrderAndDuplicates: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
OutOfOrderAndDuplicates.args = {
  chapterNumbers: ["10", "2", "10"],
};

export const ArabicIndicNumerals: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
ArabicIndicNumerals.args = {
  chapterNumbers: ["١", "٢"],
};

export const Empty: Story<ChapterPickerArgs> = (args) => <ChapterPicker {...args} />;
Empty.args = {
  chapterNumbers: [],
};
