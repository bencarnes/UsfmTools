import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  nextViewMode,
  ViewModeCycleButton,
  VIEW_MODE_LABELS,
} from "../src/components/usfm-pane/view-mode-toggle.js";

describe("view-mode-toggle", () => {
  it("cycles edit → preview → split → edit", () => {
    expect(nextViewMode("edit")).toBe("preview");
    expect(nextViewMode("preview")).toBe("split");
    expect(nextViewMode("split")).toBe("edit");
  });

  it("shows the icon for the next mode in the button label", () => {
    render(
      <ViewModeCycleButton viewMode="edit" onCycle={() => {}} buttonStyle={{}} />,
    );
    expect(
      screen.getByRole("button", { name: `Switch to ${VIEW_MODE_LABELS.preview} view` }),
    ).toBeTruthy();
  });
});
