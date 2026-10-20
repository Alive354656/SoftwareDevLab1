import { Document, type StructureSnapshot } from "../model/Document";
import { Group } from "../model/Group";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class UngroupCommand extends Command {
  private executed = false;
  private document: Document | null = null;
  private before: StructureSnapshot | null = null;
  private after: StructureSnapshot | null = null;
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length !== 1) {
      throw new CommandError("usage: ungroup <gid>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      document.restoreStructure(this.heldAfter(document));
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const id = this.args[0] ?? "";
    const group = document.require(id).asContainer();
    if (group === null) {
      throw new CommandError(`not a container: ${id}`);
    }
    const parent = group.parent;
    if (!(parent instanceof Group)) {
      if (parent === document) {
        throw new CommandError(`cannot ungroup top-level container: ${id}`);
      }
      throw new Error("shape is not in the document");
    }
    const index = document.indexInParent(group);
    const children = group.copyChildren();
    const before = document.captureStructure();
    // 孩子不是组的兄弟，先摘掉他们不会改组的下标。再按原顺序填回这个下标。
    for (const child of children) {
      document.detach(child);
    }
    document.detach(group);
    for (const [offset, child] of children.entries()) {
      document.insert(parent, child, index + offset);
    }
    this.document = document;
    this.before = before;
    this.after = document.captureStructure();
    this.forward = `${group.label()} ungrouped`;
    this.backward = `${group.label()} restored`;
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    const document = this.document;
    const before = this.before;
    if (!this.executed || document === null || before === null) {
      throw new Error("ungroup was not executed");
    }
    document.restoreStructure(before);
    return this.backward;
  }

  private heldAfter(document: Document): StructureSnapshot {
    if (this.after === null || this.document !== document) {
      throw new Error("ungroup was not executed");
    }
    return this.after;
  }
}
