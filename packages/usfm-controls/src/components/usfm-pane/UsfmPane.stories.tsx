import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withSystemTheme } from "../../../.storybook/with-theme-decorator.js";
import { SAMPLE_BSB_GENESIS_USFM } from "../../fixtures/sample-bsb-genesis-usfm.js";
import { UsfmPane } from "./UsfmPane.js";

const meta: Meta<typeof UsfmPane> = {
  title: "Controls/UsfmPane",
  component: UsfmPane,
  decorators: [withSystemTheme],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FullBookSplit: Story = {
  render: () => {
    const [value, setValue] = useState(SAMPLE_BSB_GENESIS_USFM);
    return (
      <div className="h-[min(90vh,720px)] p-4 box-border">
        <UsfmPane value={value} onChange={setValue} defaultViewMode="split" />
      </div>
    );
  },
};

export const TwoPanesSharedState: Story = {
  render: () => {
    const [value, setValue] = useState(SAMPLE_BSB_GENESIS_USFM);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[min(92vh,760px)] p-4 box-border">
        <UsfmPane value={value} onChange={setValue} defaultViewMode="edit" />
        <UsfmPane value={value} onChange={setValue} defaultViewMode="preview" />
      </div>
    );
  },
};

export const FrontMatterNoChapters: Story = {
  render: () => {
    const [value, setValue] = useState(`\\id FRT\n\\p\n\\v 1 Front matter without chapter markers.`);
    return (
      <div className="h-[min(80vh,520px)] p-4 box-border">
        <UsfmPane value={value} onChange={setValue} defaultViewMode="split" />
      </div>
    );
  },
};
