import { readFileSync } from "node:fs";
import { SvgReader } from "../io/SvgReader";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import type { EditorContext } from "./EditorContext";

export class ReadCommand extends Command {
  override get needsDocument(): boolean {
    return false;
  }

  override assertUsage(): void {
    if (this.args.length !== 1) {
      throw new CommandError("usage: read <file.svg>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const input = this.args[0] ?? "";
    let xml: string;
    try {
      xml = readFileSync(ctx.resolvePath(input), "utf8");
    } catch {
      throw new CommandError(`cannot read file: ${input}`);
    }
    const loaded = new SvgReader().read(xml);
    ctx.replaceDocument(loaded.document, input);
    return {
      message: `read ${input} (${loaded.document.elementCount()} elements)`,
      warnings: loaded.warnings,
      effect: "reset",
    };
  }
}
