import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { cleanup, fireEvent, render, screen } from "./testing-react.ts";
import { UnsavedChangesDialog } from "../src/components/usfm-shell/unsaved-changes-dialog.js";

describe("UnsavedChangesDialog", () => {
  it("offers save, discard, and cancel actions", () => {
    const onSave = spy(() => {});
    const onDiscard = spy(() => {});
    const onCancel = spy(() => {});
    render(
      <UnsavedChangesDialog
        fileName="GEN.usfm"
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/GEN\.usfm/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("unsaved-changes-save"));
    expect(onSave.calls.length).toBe(1);

    cleanup();
    render(
      <UnsavedChangesDialog
        fileName="GEN.usfm"
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("unsaved-changes-discard"));
    expect(onDiscard.calls.length).toBe(1);

    cleanup();
    render(
      <UnsavedChangesDialog
        fileName="GEN.usfm"
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("unsaved-changes-cancel"));
    expect(onCancel.calls.length).toBe(1);
  });
});
