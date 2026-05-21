import { PLACEHOLDER_TEXT } from "./placeholder";

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <p className="text-center text-lg font-medium tracking-tight">
        {PLACEHOLDER_TEXT}
      </p>
    </div>
  );
}

export default App;
