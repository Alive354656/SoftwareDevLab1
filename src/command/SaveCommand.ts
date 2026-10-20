import { SvgWriter } from "../io/SvgWriter";
import { ModelError } from "../model/ModelError";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class SaveCommand extends Command {
  override assertUsage(): void {
    if (this.args.length > 1) {
      throw new CommandError("usage: save [file.svg]");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    const input = this.args.length === 1 ? (this.args[0] ?? "") : ctx.filePath;
    if (input === null || input === "") {
      throw new CommandError("no file path. use 'save <file.svg>'");
    }
    try {
      new SvgWriter().write(document, ctx.resolvePath(input));
    } catch (error) {
      if (error instanceof ModelError || error instanceof CommandError) {
        throw error;
      }
      throw new CommandError(`cannot write file: ${input}`);
    }
    ctx.setFilePath(input);
    return {
      message: `saved to ${input} (${document.elementCount()} elements)`,
      warnings: [],
      effect: "lock",
    };
  }
}
