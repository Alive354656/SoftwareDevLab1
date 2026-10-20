import type { Document, StructureSnapshot } from "../model/Document";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class BackCommand extends Command {
  private executed = false;
  private document: Document | null = null;
  private before: StructureSnapshot | null = null;
  private after: StructureSnapshot | null = null;
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length !== 1) {
      throw new CommandError("usage: back <id>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      document.restoreStructure(this.heldAfter(document));
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const shape = document.require(this.args[0] ?? "");
    const before = document.captureStructure();
    document.moveWithinParent(shape, 0);
    this.document = document;
    this.before = before;
    this.after = document.captureStructure();
    this.forward = `${shape.label()} sent to back`;
    this.backward = `${shape.label()} z-order restored`;
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    const document = this.document;
    const before = this.before;
    if (!this.executed || document === null || before === null) {
      throw new Error("back was not executed");
    }
    document.restoreStructure(before);
    return this.backward;
  }

  private heldAfter(document: Document): StructureSnapshot {
    if (this.after === null || this.document !== document) {
      throw new Error("back was not executed");
    }
    return this.after;
  }
}
