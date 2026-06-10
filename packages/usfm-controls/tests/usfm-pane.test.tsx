import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanup, render, screen, fireEvent, waitFor } from "./testing-react.ts";
import { UsfmPane } from "../src/components/usfm-pane/UsfmPane.js";
import { VIEW_MODE_LABELS } from "../src/components/usfm-pane/view-mode-toggle.js";


describe("UsfmPane", () => {
  it("shows the toolbar and view mode cycle control", () => {
    render(<UsfmPane value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} defaultViewMode="edit" />);
    expect(screen.getByTestId("usfm-pane-toolbar")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: `Switch to ${VIEW_MODE_LABELS.preview} view` }),
    ).toBeTruthy();
  });

  it("disables chapter arrows when the book has no \\c markers", () => {
    render(
      <UsfmPane value={"\\id FRT\n\\p\n\\v 1 Front matter only."} defaultViewMode="preview" />,
    );
    expect(screen.getByLabelText("Previous chapter").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Next chapter").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Previous chapter").getAttribute("title")).toBe("Previous chapter");
    expect(screen.getByLabelText("Next chapter").getAttribute("title")).toBe("Next chapter");
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText(/Chapters/)).toBeNull();
  });

  it("opens chapter list from the chapter number control", () => {
    render(
      <UsfmPane
        value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello.\n\\c 2\n\\p\n\\v 1 More."}
        defaultViewMode="edit"
      />,
    );
    expect(screen.queryByText(/Chapters/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/select chapter/i));
    expect(screen.getByRole("button", { name: /Open chapter 2/ })).toBeTruthy();
  });

  it("exposes a scroll sync switch disabled without chapter markers", () => {
    render(<UsfmPane value={"\\id FRT\n\\p\n\\v 1 Front matter only."} defaultViewMode="split" />);
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.hasAttribute("disabled")).toBe(true);
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("toggles scroll sync when chapter markers exist", () => {
    render(<UsfmPane value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} defaultViewMode="split" />);
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.hasAttribute("disabled")).toBe(false);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("opens find from the toolbar in edit view", async () => {
    const { container } = render(
      <UsfmPane value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} defaultViewMode="edit" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Find in document" }));
    await waitFor(() => {
      expect(container.querySelector(".usfm-search-panel")).toBeTruthy();
    });
  });

  it("disables find in preview-only view", () => {
    render(<UsfmPane value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} defaultViewMode="preview" />);
    expect(screen.getByRole("button", { name: "Find in document" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("cycles view mode when the toolbar control is clicked", () => {
    render(<UsfmPane value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} defaultViewMode="edit" />);
    const cycleTo = (mode: keyof typeof VIEW_MODE_LABELS) =>
      screen.getByRole("button", { name: `Switch to ${VIEW_MODE_LABELS[mode]} view` });

    fireEvent.click(cycleTo("preview"));
    expect(screen.queryByRole("separator")).toBeNull();
    fireEvent.click(cycleTo("split"));
    expect(screen.getByRole("separator")).toBeTruthy();
    fireEvent.click(cycleTo("edit"));
    expect(screen.queryByRole("separator")).toBeNull();
    expect(cycleTo("preview")).toBeTruthy();
  });
});
