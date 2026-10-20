import path from "node:path";
import { CommandLineParser } from "../cli/CommandLineParser";
import { LineSyntaxError } from "../cli/LineSyntaxError";
import { CommandError } from "../command/CommandError";
import { CommandRegistry } from "../command/CommandRegistry";
import type { EditorContext } from "../command/EditorContext";
import { ModelError } from "../model/ModelError";

export class EditorSession implements EditorContext {
  readonly document: null = null;
  filePath: string | null = null;

  private readonly parser = new CommandLineParser();
  private readonly registry = new CommandRegistry();

  executeLine(line: string): string[] {
    try {
      const parsed = this.parser.parse(line);
      if (parsed === null) {
        return [];
      }
      const command = this.registry.create(parsed.name, parsed.args);
      if (command.needsDocument && this.document === null) {
        throw new CommandError("no document. use 'init' or 'read' first");
      }
      command.assertUsage();
      if (command.meta === "undo") {
        throw new Error("not implemented: undo history");
      }
      if (command.meta === "redo") {
        throw new Error("not implemented: redo history");
      }
      const result = command.execute(this);
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

  replaceDocument(_document: unknown, _filePath: string | null): void {
    throw new Error("not implemented: replaceDocument");
  }

  setFilePath(filePath: string | null): void {
    this.filePath = filePath;
  }

  resolvePath(input: string): string {
    return path.resolve(process.cwd(), input);
  }
}
