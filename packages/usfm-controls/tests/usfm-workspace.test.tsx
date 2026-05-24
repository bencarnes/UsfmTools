import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { UsfmWorkspace } from "../src/components/usfm-workspace/UsfmWorkspace.js";

afterEach(() => {
  cleanup();
});

describe("UsfmWorkspace", () => {
  it("renders tab labels from file names", () => {
    render(
      <UsfmWorkspace
        initialTabs={[
          { id: "t-a", fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hi." },
          { id: "t-b", fileName: "EXO.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 Hi." },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: /GEN\.usfm/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /EXO\.usfm/i })).toBeTruthy();
  });

  it("shows dirty stub as a circle on the close control", () => {
    render(
      <UsfmWorkspace
        initialTabs={[
          { id: "t-d", fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hi.", dirty: true },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /close tab \(unsaved/i })).toBeTruthy();
  });

  it("updates toolbar controls when switching tabs", () => {
    render(
      <UsfmWorkspace
        initialTabs={[
          {
            id: "t1",
            fileName: "One.usfm",
            value: "\\id GEN\n\\c 1\n\\p\n\\v 1 One.\n\\c 2\n\\p\n\\v 1 Two.",
          },
          {
            id: "t2",
            fileName: "Two.usfm",
            value: "\\id FRT\n\\p\n\\v 1 Front matter without chapters.",
          },
        ]}
      />,
    );
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: /Two\.usfm/i }));
    expect(
      screen.getByRole("switch", { name: /scroll sync between editor and preview/i }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("activates a tab from the tab list dropdown", () => {
    render(
      <UsfmWorkspace
        initialTabs={[
          { id: "x1", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
          { id: "x2", fileName: "B.usfm", value: "\\id EXO\n\\c 2\n\\p\n\\v 1 B" },
        ]}
      />,
    );
    const select = screen.getByRole("combobox", { name: /open tab/i });
    fireEvent.change(select, { target: { value: "x2" } });
    expect(screen.getByRole("tab", { name: /B\.usfm/i }).getAttribute("aria-selected")).toBe("true");
  });
});
