import { afterEach } from "@std/testing/bdd";
import { cleanup } from "./testing-react.ts";

type DomTestHookOptions = {
  /** Wait for CodeMirror / React timers to finish before unmounting. */
  flushTimers?: boolean;
};

/** Unmount React trees between tests in the current module. */
export function registerDomTestHooks(options: DomTestHookOptions = {}): void {
  afterEach(async () => {
    if (options.flushTimers) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    cleanup();
  });
}
