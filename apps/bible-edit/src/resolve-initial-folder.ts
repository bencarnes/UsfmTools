/** Pure decision logic for the first USFM folder shown on startup. */
export function resolveInitialFolderPath(options: {
  readonly sessionFolder: string | null;
  readonly sessionFolderExists: boolean;
  readonly sampleCorpusExists: boolean;
  readonly sampleCorpusPath: string;
  readonly appDataLibraryPath: string;
}): string {
  if (options.sessionFolder && options.sessionFolderExists) {
    return options.sessionFolder;
  }
  if (options.sampleCorpusExists) {
    return options.sampleCorpusPath;
  }
  return options.appDataLibraryPath;
}
