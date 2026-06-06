import { describe, expect, it } from "vitest";
import { getSystemTheme, resolveUiTheme } from "../src/components/settings-pane/theme-utils.js";

describe("theme-utils", () => {
  it("resolveUiTheme maps explicit preferences", () => {
    expect(resolveUiTheme("light", "dark")).toBe("light");
    expect(resolveUiTheme("dark", "light")).toBe("dark");
    expect(resolveUiTheme("system", "dark")).toBe("dark");
    expect(resolveUiTheme("system", "light")).toBe("light");
  });

  it("getSystemTheme returns light or dark", () => {
    const theme = getSystemTheme();
    expect(theme === "light" || theme === "dark").toBe(true);
  });
});
