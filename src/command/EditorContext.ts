import type { Document } from "../model/Document";
import { CommandError } from "./CommandError";

export interface EditorContext {
  readonly document: Document | null;
  readonly filePath: string | null;
  replaceDocument(document: Document, filePath: string | null): void;
  setFilePath(filePath: string | null): void;
  resolvePath(input: string): string;
}

export function requireDocument(ctx: EditorContext): Document {
  if (ctx.document === null) {
    throw new CommandError("no document. use 'init' or 'read' first");
  }
  return ctx.document;
}
