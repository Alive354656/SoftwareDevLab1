import { Command } from "./Command";
import { CommandError } from "./CommandError";

export class ReadCommand extends Command {
  override get needsDocument(): boolean {
    return false;
  }

  override assertUsage(): void {
    if (this.args.length !== 1) {
      throw new CommandError("usage: read <file.svg>");
    }
  }
}
