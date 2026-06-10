import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register();
}

// Deno 2 does not expose `window` as a global; happy-dom provides it on document.defaultView.
if (!("window" in globalThis) && globalThis.document?.defaultView) {
  Object.defineProperty(globalThis, "window", {
    value: globalThis.document.defaultView,
    configurable: true,
    writable: true,
  });
}

const win = globalThis as typeof globalThis & {
  matchMedia?: (query: string) => MediaQueryList;
};
if (typeof win.matchMedia !== "function") {
  win.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
