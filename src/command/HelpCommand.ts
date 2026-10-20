import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import type { EditorContext } from "./EditorContext";
import { HelpText } from "./HelpText";

export class HelpCommand extends Command {
  override get needsDocument(): boolean {
    return false;
  }

  override assertUsage(): void {
    if (this.args.length !== 0) {
      throw new CommandError("usage: help");
    }
  }

  override execute(_ctx: EditorContext): CommandResult {
    return {
      message: HelpText.body,
      warnings: [],
      effect: "none",
    };
  }
}
