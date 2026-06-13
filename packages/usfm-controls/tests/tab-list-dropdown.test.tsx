import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { cleanup, render, screen, fireEvent } from "./testing-react.ts";
import { TabListDropdown } from "../src/components/usfm-workspace/tab-list-dropdown.js";


describe("TabListDropdown", () => {
  it("shows a chevron button with tooltip and no visible label text", () => {
    render(
      <TabListDropdown
        tabIds={["a", "b"]}
        activeTabId="a"
        tabsById={{
          a: { id: "a", fileName: "A.usfm", value: "", savedValue: "", dirty: false },
          b: { id: "b", fileName: "B.usfm", value: "", savedValue: "", dirty: false },
        }}
        onActivate={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: "Select tab" });
    expect(btn.getAttribute("title")).toBe("Select tab");
    expect(btn.textContent?.trim()).toBe("");
  });

  it("activates a tab from the list", () => {
    const onActivate = spy((_id: string) => {});
    render(
      <TabListDropdown
        tabIds={["a", "b"]}
        activeTabId="a"
        tabsById={{
          a: { id: "a", fileName: "A.usfm", value: "", savedValue: "", dirty: false },
          b: { id: "b", fileName: "B.usfm", value: "", savedValue: "", dirty: false },
        }}
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select tab" }));
    fireEvent.click(screen.getByRole("option", { name: "B.usfm" }));
    expect(onActivate.calls[0]?.args).toEqual(["b"]);
  });
});
