import { Command } from "./Command";
import { CommandError } from "./CommandError";

export class InitCommand extends Command {
  override get needsDocument(): boolean {
    return false;
  }

  override assertUsage(): void {
    if (this.args.length !== 0 && this.args.length !== 2) {
      throw new CommandError("usage: init [w] [h]");
    }
  }
}
