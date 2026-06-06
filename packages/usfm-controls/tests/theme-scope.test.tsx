import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsProvider, useSettings } from "../src/components/settings-pane/settings-context.js";
import type { SettingsHost } from "../src/components/settings-pane/settings-model.js";
import { ThemeScope } from "../src/components/settings-pane/theme-scope.js";

afterEach(() => {
  cleanup();
});

function makeHost(initialTheme: "light" | "dark" | "system" = "system"): SettingsHost {
  const store = { value: initialTheme === "system" ? null : { theme: initialTheme } };
  return {
    async loadSettings() {
      return store.value;
    },
    async saveSettings(next) {
      store.value = next;
    },
  };
}

function SetDarkButton() {
  const { setTheme } = useSettings();
  return (
    <button type="button" data-testid="set-dark" onClick={() => setTheme("dark")}>
      dark
    </button>
  );
}

describe("ThemeScope", () => {
  it("applies data-theme from an explicit theme prop", () => {
    render(
      <ThemeScope theme="dark">
        <div data-testid="child">Hello</div>
      </ThemeScope>,
    );
    expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("dark");
    expect(screen.getByTestId("theme-scope").classList.contains("dark")).toBe(true);
  });

  it("follows SettingsProvider theme changes", async () => {
    render(
      <SettingsProvider host={makeHost("light")}>
        <SetDarkButton />
      </SettingsProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("light"),
    );

    fireEvent.click(screen.getByTestId("set-dark"));
    await waitFor(() =>
      expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("dark"),
    );
  });
});
