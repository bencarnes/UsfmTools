import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installNativeSystemTheme } from "./system-theme";
import "../../../../packages/usfm-controls/src/styles.css";
import "./index.css";

function render() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Seed the OS theme from the backend before first paint so "System" resolves correctly on Linux,
// then render regardless of whether detection succeeds.
void installNativeSystemTheme().finally(render);
