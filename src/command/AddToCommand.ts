import type { Document, StructureSnapshot } from "../model/Document";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class AddToCommand extends Command {
  private executed = false;
  private document: Document | null = null;
  private before: StructureSnapshot | null = null;
  private after: StructureSnapshot | null = null;
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length !== 2) {
      throw new CommandError("usage: addto <gid> <id>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      document.restoreStructure(this.heldAfter(document));
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const containerId = this.args[0] ?? "";
    const found = document.find(containerId);
    if (found === undefined) {
      throw new CommandError(`no such container: ${containerId}`);
    }
    const container = found.asContainer();
    if (container === null) {
      throw new CommandError(`not a container: ${containerId}`);
    }
    const shape = document.require(this.args[1] ?? "");
    if (shape === container || shape.encloses(container)) {
      throw new CommandError(`cannot add a container into its own descendant: ${shape.id}`);
    }
    const parent = shape.parent;
    if (parent === null) {
      throw new Error("shape is not in the document");
    }
    const before = document.captureStructure();
    const forward = `${shape.label()} added to ${container.label()}`;
    const backward = `${shape.label()} moved back to ${parent.ownerLabel()}`;
    document.detach(shape);
    document.insert(container, shape, container.childCount());
    this.document = document;
    this.before = before;
    this.after = document.captureStructure();
    this.forward = forward;
    this.backward = backward;
    this.executed = true;
    return { message: forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    const document = this.document;
    const before = this.before;
    if (!this.executed || document === null || before === null) {
      throw new Error("addto was not executed");
    }
    document.restoreStructure(before);
    return this.backward;
  }

  private heldAfter(document: Document): StructureSnapshot {
    if (this.after === null || this.document !== document) {
      throw new Error("addto was not executed");
    }
    return this.after;
  }
}
