import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { PLACEHOLDER_TEXT } from "./placeholder";

describe("App", () => {
  it("renders the placeholder message", () => {
    render(<App />);
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeInTheDocument();
  });

  it("exposes the message in a paragraph for readability", () => {
    render(<App />);
    const el = screen.getByText(PLACEHOLDER_TEXT);
    expect(el.tagName).toBe("P");
  });
});
