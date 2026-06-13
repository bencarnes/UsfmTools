export interface UnsavedChangesDialogProps {
  readonly fileName: string;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
}

/** Modal prompt when closing a tab or the app with unsaved editor changes. */
export function UnsavedChangesDialog({
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      data-testid="unsaved-changes-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-dialog-title"
        aria-describedby="unsaved-changes-dialog-message"
        className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-5 shadow-lg dark:border-gray-600 dark:bg-gray-900"
        data-testid="unsaved-changes-dialog"
      >
        <h2
          id="unsaved-changes-dialog-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          Save changes?
        </h2>
        <p
          id="unsaved-changes-dialog-message"
          className="mt-2 text-sm text-gray-700 dark:text-gray-300"
        >
          Do you want to save changes to <span className="font-medium">{fileName}</span> before closing?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            onClick={onCancel}
            data-testid="unsaved-changes-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            onClick={onDiscard}
            data-testid="unsaved-changes-discard"
          >
            Discard
          </button>
          <button
            type="button"
            className="rounded border border-blue-700 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            onClick={onSave}
            data-testid="unsaved-changes-save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
