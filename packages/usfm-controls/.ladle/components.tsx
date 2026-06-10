import type { GlobalProvider } from "@ladle/react";
import "../src/styles.css";
import { ThemeScope } from "../src/components/settings-pane/theme-scope.tsx";

export const Provider: GlobalProvider = ({ children }) => (
  <ThemeScope theme="system">{children}</ThemeScope>
);
