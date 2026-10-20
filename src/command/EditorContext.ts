export interface EditorContext {
  readonly document: null;
  readonly filePath: string | null;
  replaceDocument(document: unknown, filePath: string | null): void;
  setFilePath(filePath: string | null): void;
  resolvePath(input: string): string;
}
