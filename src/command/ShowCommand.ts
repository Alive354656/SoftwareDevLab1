import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class ShowCommand extends Command {
  override assertUsage(): void {
    if (this.args.length !== 1) {
      throw new CommandError("usage: show <id>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    return {
      message: document.renderShow(this.args[0] ?? ""),
      warnings: [],
      effect: "none",
    };
  }
}
