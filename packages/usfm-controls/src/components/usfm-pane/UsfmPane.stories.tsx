import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";
import { SAMPLE_BSB_GENESIS_USFM } from "../../fixtures/sample-bsb-genesis-usfm.js";
import { UsfmPane } from "./UsfmPane.js";

export default {
  title: "Controls/UsfmPane",
} satisfies StoryDefault;

export const FullBookSplit: Story = () => {
  const [value, setValue] = useState(SAMPLE_BSB_GENESIS_USFM);
  return (
    <div className="h-[min(90vh,720px)] p-4 box-border">
      <UsfmPane value={value} onChange={setValue} defaultViewMode="split" />
    </div>
  );
};

export const TwoPanesSharedState: Story = () => {
  const [value, setValue] = useState(SAMPLE_BSB_GENESIS_USFM);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[min(92vh,760px)] p-4 box-border">
      <UsfmPane value={value} onChange={setValue} defaultViewMode="edit" />
      <UsfmPane value={value} onChange={setValue} defaultViewMode="preview" />
    </div>
  );
};

export const FrontMatterNoChapters: Story = () => {
  const [value, setValue] = useState(`\\id FRT\n\\p\n\\v 1 Front matter without chapter markers.`);
  return (
    <div className="h-[min(80vh,520px)] p-4 box-border">
      <UsfmPane value={value} onChange={setValue} defaultViewMode="split" />
    </div>
  );
};
