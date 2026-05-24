import type { Meta, StoryObj } from "@storybook/react";
import { UsfmWorkspace } from "./UsfmWorkspace.js";
import { SAMPLE_BOOK } from "../usfm-pane/UsfmPane.stories.js";

const meta: Meta<typeof UsfmWorkspace> = {
  title: "Controls/UsfmWorkspace",
  component: UsfmWorkspace,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const SHORT_EXO = `\\id EXO
\\c 1
\\p
\\v 1 These are the names of the sons of Israel who went to Egypt with Jacob, each with his family:
`;

export const SingleGroupTwoTabs: Story = {
  render: () => (
    <div className="h-[min(90vh,720px)] p-4 box-border">
      <UsfmWorkspace
        initialTabs={[
          { fileName: "GEN.usfm", value: SAMPLE_BOOK },
          { fileName: "EXO.usfm", value: SHORT_EXO, dirty: true },
        ]}
      />
    </div>
  ),
};

export const TwoEditorGroups: Story = {
  render: () => (
    <div className="h-[min(90vh,720px)] p-4 box-border">
      <UsfmWorkspace
        initialTabs={[
          { fileName: "GEN.usfm", value: SAMPLE_BOOK, groupIndex: 0 },
          { fileName: "EXO.usfm", value: SHORT_EXO, groupIndex: 1 },
        ]}
      />
    </div>
  ),
};
