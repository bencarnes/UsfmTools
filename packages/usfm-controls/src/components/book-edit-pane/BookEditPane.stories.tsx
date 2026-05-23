import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { BookEditPane } from "./BookEditPane.js";

/** Multi-chapter sample for split / dual-pane stories (enough text to scroll and exercise chapter nav). */
const SAMPLE_BOOK = `\\id GEN Sample
\\h Genesis
\\toc2 Genesis
\\mt1 Book of Genesis

\\c 1
\\s1 The creation of heaven and earth
\\p
\\v 1 In the beginning God created the heavens and the earth.
\\v 2 Now the earth was \\nd formless\\nd* and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters.
\\v 3 And God said, “Let there be light,” and there was light.
\\p
\\v 4 God saw that the light was good, and he separated the light from the darkness.
\\v 5 God called the light “day,” and the darkness he called “night.” And there was evening, and there was morning—the first day.

\\c 2
\\s1 Adam and Eve
\\p
\\v 4 This is the account of the heavens and the earth when they were created, when the Lord God made the earth and the heavens.
\\p
\\v 7 Then the Lord God formed a man from the dust of the ground and breathed into his nostrils the breath of life, and the man became a living being.
\\v 8 Now the Lord God had planted a garden in the east, in Eden; and there he put the man he had formed.

\\c 3
\\s1 The fall
\\p
\\v 1 Now the serpent was more crafty than any of the wild animals the Lord God had made.
\\p
He said to the woman, “Did God really say, ‘You must not eat from any tree in the garden’?”
\\p
\\v 2 The woman said to the serpent, “We may eat fruit from the trees in the garden, \\v 3 but God did say, ‘You must not eat fruit from the tree that is in the middle of the garden, and you must not touch it, or you will die.’”

\\c 4
\\s1 Cain and Abel
\\p
\\v 1 Adam made love to his wife Eve, and she became pregnant and gave birth to Cain. She said, “With the help of the Lord I have brought forth a man.”
\\p
\\v 2 Later she gave birth to his brother Abel. Now Abel kept flocks, and Cain worked the soil.
\\v 3 In the course of time Cain brought some of the fruits of the soil as an offering to the Lord.
\\v 4 And Abel also brought an offering—fat portions from some of the firstborn of his flock. The Lord looked with favor on Abel and his offering,
\\v 5 but on Cain and his offering he did not look with favor. So Cain was very angry, and his face was downcast.
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
