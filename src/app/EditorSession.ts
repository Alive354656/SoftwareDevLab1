import path from "node:path";
import { CommandLineParser } from "../cli/CommandLineParser";
import { LineSyntaxError } from "../cli/LineSyntaxError";
import { CommandError } from "../command/CommandError";
import { CommandHistory } from "../command/CommandHistory";
import { CommandRegistry } from "../command/CommandRegistry";
import type { EditorContext } from "../command/EditorContext";
import { Document } from "../model/Document";
import { ModelError } from "../model/ModelError";

export class EditorSession implements EditorContext {
  private documentValue: Document | null = null;
  filePath: string | null = null;

  private readonly parser = new CommandLineParser();
  private readonly registry = new CommandRegistry();
  private readonly history = new CommandHistory();

  get document(): Document | null {
    return this.documentValue;
  }

  get undoDepth(): number {
    return this.history.undoDepth;
  }

  get redoDepth(): number {
    return this.history.redoDepth;
  }

  get historyLocked(): boolean {
    return this.history.locked;
  }

  executeLine(line: string): string[] {
    try {
      const parsed = this.parser.parse(line);
      if (parsed === null) {
        return [];
      }
      const command = this.registry.create(parsed.name, parsed.args);
      if (command.needsDocument && this.documentValue === null) {
        throw new CommandError("no document. use 'init' or 'read' first");
      }
      command.assertUsage();
      if (command.meta === "undo") {
        return [this.history.undo()];
      }
      if (command.meta === "redo") {
        return [this.history.redo(this)];
      }
      const result = command.execute(this);
      this.history.apply(result.effect, command);
      return [...result.warnings, result.message];
    } catch (error) {
      if (
        error instanceof CommandError ||
        error instanceof ModelError ||
        error instanceof LineSyntaxError
      ) {
        return [`error: ${error.message}`];
      }
      throw error;
    }
  }

  replaceDocument(document: Document, filePath: string | null): void {
    this.documentValue = document;
    this.filePath = filePath;
  }

  setFilePath(filePath: string | null): void {
    this.filePath = filePath;
  }

  resolvePath(input: string): string {
    return path.resolve(process.cwd(), input);
  }
}
