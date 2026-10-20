import { Command } from "./Command";
import { CommandError } from "./CommandError";

export class RedoCommand extends Command {
  override readonly meta: "redo" = "redo";

  override assertUsage(): void {
    if (this.args.length !== 0) {
      throw new CommandError("usage: redo");
    }
  }
}
