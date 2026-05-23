import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BookEditPane } from "../src/components/book-edit-pane/BookEditPane.js";

afterEach(() => {
  cleanup();
});

describe("BookEditPane", () => {
  it("shows the book title and view mode controls", () => {
    render(
      <BookEditPane
        bookTitle="GEN"
        value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."}
        defaultViewMode="edit"
      />,
    );
    expect(screen.getByText("GEN")).toBeTruthy();
    expect(screen.getByRole("group", { name: /view mode/i })).toBeTruthy();
  });

  it("disables chapter arrows when the book has no \\c markers", () => {
    render(
      <BookEditPane
        bookTitle="FRT"
        value={"\\id FRT\n\\p\n\\v 1 Front matter only."}
        defaultViewMode="preview"
      />,
    );
    expect(screen.getByLabelText("Previous chapter").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Next chapter").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("—")).toBeTruthy();
  });



  it("exposes a scroll sync switch disabled without chapter markers", () => {
    render(
      <BookEditPane
        bookTitle="FRT"
        value={"\\id FRT\\n\\p\\n\\v 1 Front matter only."}
        defaultViewMode="split"
      />,
    );
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.hasAttribute("disabled")).toBe(true);
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("toggles scroll sync when chapter markers exist", () => {
    render(
      <BookEditPane
        bookTitle="GEN"
        value={"\\id GEN\\n\\c 1\\n\\p\\n\\v 1 Hello."}
        defaultViewMode="split"
      />,
    );
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.hasAttribute("disabled")).toBe(false);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("switches view mode when the toolbar buttons are activated", () => {
    render(
      <BookEditPane
        bookTitle="GEN"
        value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."}
        defaultViewMode="edit"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("button", { name: "Preview" }).getAttribute("aria-pressed")).toBe("true");
  });
});
