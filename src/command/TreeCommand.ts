import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class TreeCommand extends Command {
  override assertUsage(): void {
    if (this.args.length > 1) {
      throw new CommandError("usage: tree [id]");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    const id = this.args[0];
    const message = id === undefined ? document.renderTree() : document.renderTree(id);
    return { message, warnings: [], effect: "none" };
  }
}
