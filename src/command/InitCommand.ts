import { Document } from "../model/Document";
import { NumberText } from "../model/NumberText";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import type { EditorContext } from "./EditorContext";

export class InitCommand extends Command {
  override get needsDocument(): boolean {
    return false;
  }

  override assertUsage(): void {
    if (this.args.length !== 0 && this.args.length !== 2) {
      throw new CommandError("usage: init [w] [h]");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const width = this.args.length === 0 ? 800 : this.parseSize(this.args[0] ?? "");
    const height = this.args.length === 0 ? 600 : this.parseSize(this.args[1] ?? "");
    ctx.replaceDocument(new Document(width, height), null);
    return {
      message: `canvas ${NumberText.format(width)}x${NumberText.format(height)} created`,
      warnings: [],
      effect: "reset",
    };
  }

  private parseSize(token: string): number {
    // 画布尺寸的非数字、非有限和小于等于 0 都用同一句；几何数字仍是 invalid number。
    const value = Number(token);
    if (!Number.isFinite(value) || !(value > 0)) {
      throw new CommandError("size must be positive");
    }
    return value;
  }
}
