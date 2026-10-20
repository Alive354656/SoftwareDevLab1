import { Document, type StructureSnapshot } from "../model/Document";
import { Group } from "../model/Group";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class GroupCommand extends Command {
  private executed = false;
  private document: Document | null = null;
  private before: StructureSnapshot | null = null;
  private after: StructureSnapshot | null = null;
  private shape: Group | null = null;
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length < 3) {
      throw new CommandError("usage: group <newGid> <id1> <id2>...");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      document.restoreStructure(this.heldAfter(document));
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const newId = this.args[0] ?? "";
    if (document.find(newId) !== undefined) {
      throw new CommandError(`id already exists: ${newId}`);
    }
    const memberIds = this.args.slice(1);
    const members = memberIds.map(id => document.require(id));
    const seen = new Set<string>();
    for (const id of memberIds) {
      if (seen.has(id)) {
        throw new CommandError(`duplicate id: ${id}`);
      }
      seen.add(id);
    }
    for (const member of members) {
      for (const other of members) {
        if (other !== member && member.encloses(other)) {
          throw new CommandError(`cannot group a container into its own descendant: ${member.id}`);
        }
      }
    }
    // 参数顺序只用于上面的报错。收编顺序是文档先序，新组占住第一个成员原来的位置。
    const ordered = document.orderByDocument(members);
    const anchor = ordered[0];
    if (anchor === undefined) {
      throw new Error("group has no members");
    }
    const parent = anchor.parent;
    if (parent === null) {
      throw new Error("shape is not in the document");
    }
    const index = document.indexInParent(anchor);
    const shape = new Group(newId);
    const before = document.captureStructure();
    for (const member of ordered) {
      document.detach(member);
    }
    document.insert(parent, shape, index);
    for (const [childIndex, member] of ordered.entries()) {
      document.insert(shape, member, childIndex);
    }
    this.document = document;
    this.before = before;
    this.after = document.captureStructure();
    this.shape = shape;
    this.forward = `${shape.label()} created with ${ordered.length} children`;
    this.backward = `${shape.label()} removed`;
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    const document = this.document;
    const before = this.before;
    if (!this.executed || document === null || before === null || this.shape === null) {
      throw new Error("group was not executed");
    }
    document.restoreStructure(before);
    return this.backward;
  }

  private heldAfter(document: Document): StructureSnapshot {
    if (this.after === null || this.document !== document) {
      throw new Error("group was not executed");
    }
    return this.after;
  }
}
