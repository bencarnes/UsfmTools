import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { TabListDropdown } from "../src/components/usfm-workspace/tab-list-dropdown.js";

afterEach(() => {
  cleanup();
});

describe("TabListDropdown", () => {
  it("shows a chevron button with tooltip and no visible label text", () => {
    render(
      <TabListDropdown
        tabIds={["a", "b"]}
        activeTabId="a"
        tabsById={{
          a: { id: "a", fileName: "A.usfm", value: "", dirty: false },
          b: { id: "b", fileName: "B.usfm", value: "", dirty: false },
        }}
        onActivate={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: "Select tab" });
    expect(btn.getAttribute("title")).toBe("Select tab");
    expect(btn.textContent?.trim()).toBe("");
  });

  it("activates a tab from the list", () => {
    const onActivate = vi.fn();
    render(
      <TabListDropdown
        tabIds={["a", "b"]}
        activeTabId="a"
        tabsById={{
          a: { id: "a", fileName: "A.usfm", value: "", dirty: false },
          b: { id: "b", fileName: "B.usfm", value: "", dirty: false },
        }}
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select tab" }));
    fireEvent.click(screen.getByRole("option", { name: "B.usfm" }));
    expect(onActivate).toHaveBeenCalledWith("b");
  });
});
