import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { BookEditPane } from "./BookEditPane.js";

const SAMPLE_BOOK = `\\id GEN Sample
\\h Genesis
\\c 1
\\s1 The Creation
\\p \\v 1 In the beginning God created the heavens and the earth. \\v 2 Now the earth was \\nd void\\nd* and without form.
\\c 2
\\p \\v 1 Thus the heavens and the earth were completed in all their vast array.
`;

const meta = {
  title: "Controls/BookEditPane",
  component: BookEditPane,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof BookEditPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullBookSplit: Story = {
  render: () => {
    const [value, setValue] = useState(SAMPLE_BOOK);
    return (
      <div className="h-[min(90vh,720px)] p-4 box-border">
        <BookEditPane bookTitle="GEN" value={value} onChange={setValue} defaultViewMode="split" />
      </div>
    );
  },
};

export const TwoPanesSharedState: Story = {
  render: () => {
    const [value, setValue] = useState(SAMPLE_BOOK);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[min(92vh,760px)] p-4 box-border">
        <BookEditPane bookTitle="Pane A" value={value} onChange={setValue} defaultViewMode="edit" />
        <BookEditPane bookTitle="Pane B" value={value} onChange={setValue} defaultViewMode="preview" />
      </div>
    );
  },
};

export const FrontMatterNoChapters: Story = {
  render: () => {
    const [value, setValue] = useState(`\\id FRT\n\\p\n\\v 1 Front matter without chapter markers.`);
    return (
      <div className="h-[min(80vh,520px)] p-4 box-border">
        <BookEditPane bookTitle="FRT" value={value} onChange={setValue} defaultViewMode="split" />
      </div>
    );
  },
};
