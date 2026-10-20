import { NumberText } from "../model/NumberText";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class CanvasCommand extends Command {
  override assertUsage(): void {
    if (this.args.length !== 0 && this.args.length !== 2) {
      throw new CommandError("usage: canvas [w] [h]");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.args.length === 0) {
      return {
        message: `canvas ${NumberText.format(document.width)}x${NumberText.format(document.height)}`,
        warnings: [],
        effect: "none",
      };
    }
    const width = this.parseSize(this.args[0] ?? "");
    const height = this.parseSize(this.args[1] ?? "");
    document.resize(width, height);
    return {
      message: `canvas resized to ${NumberText.format(width)}x${NumberText.format(height)}`,
      warnings: [],
      effect: "lock",
    };
  }

  private parseSize(token: string): number {
    const value = Number(token);
    if (!Number.isFinite(value) || !(value > 0)) {
      throw new CommandError("size must be positive");
    }
    return value;
  }
}
