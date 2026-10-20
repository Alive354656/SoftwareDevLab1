import { Command } from "./Command";
import { CommandError } from "./CommandError";

export class UndoCommand extends Command {
  override readonly meta: "undo" = "undo";

  override assertUsage(): void {
    if (this.args.length !== 0) {
      throw new CommandError("usage: undo");
    }
  }
}
