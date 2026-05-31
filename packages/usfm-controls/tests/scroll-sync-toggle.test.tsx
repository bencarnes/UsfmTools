import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ScrollSyncToggleButton } from "../src/components/usfm-pane/scroll-sync-toggle.js";

afterEach(() => {
  cleanup();
});

describe("ScrollSyncToggleButton", () => {
  it("renders as a switch with icon only (no On/Off text)", () => {
    render(
      <ScrollSyncToggleButton
        scrollSyncEnabled
        hasChapters
        buttonStyle={{}}
        onToggle={() => {}}
      />,
    );
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.textContent?.trim()).toBe("");
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("calls onToggle when clicked and chapters exist", () => {
    const onToggle = vi.fn();
    render(
      <ScrollSyncToggleButton
        scrollSyncEnabled
        hasChapters
        buttonStyle={{}}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /scroll sync between editor and preview/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
