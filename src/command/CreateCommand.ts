import { Document, type StructureSnapshot } from "../model/Document";
import type { Group } from "../model/Group";
import type { Shape } from "../model/Shape";
import { ShapeFactory } from "../model/ShapeFactory";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

const GENERIC_USAGE = "usage: create <type> <id> [params...] [in <containerId>]";

export class CreateCommand extends Command {
  private readonly factory = new ShapeFactory();
  private executed = false;
  private document: Document | null = null;
  private before: StructureSnapshot | null = null;
  private after: StructureSnapshot | null = null;
  private shape: Shape | null = null;
  private forward = "";

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      document.restoreStructure(this.heldAfter(document));
      return { message: this.forward, warnings: [], effect: "record" };
    }
    if (this.args.length === 0) {
      throw new CommandError(GENERIC_USAGE);
    }
    const type = this.args[0] ?? "";
    if (!this.factory.supports(type)) {
      throw new CommandError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    if (this.args.length < 2) {
      throw new CommandError(this.factory.usage(type));
    }
    const id = this.args[1] ?? "";
    const { params, containerId } = this.splitParams(this.args.slice(2));
    const shape = this.factory.create(type, id, params);
    if (document.find(id) !== undefined) {
      throw new CommandError(`id already exists: ${id}`);
    }
    const { parent, index, createdIn } = this.resolveParent(document, containerId);
    const before = document.captureStructure();
    document.insert(parent, shape, index);
    this.document = document;
    this.before = before;
    this.after = document.captureStructure();
    this.shape = shape;
    this.forward = `${shape.label()} created${createdIn}`;
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    const shape = this.shape;
    const document = this.document;
    const before = this.before;
    if (!this.executed || shape === null || document === null || before === null) {
      throw new Error("create was not executed");
    }
    document.restoreStructure(before);
    return `${shape.label()} removed`;
  }

  private splitParams(params: readonly string[]): {
    params: readonly string[];
    containerId: string | null;
  } {
    if (params.length >= 2 && params[params.length - 2] === "in") {
      return {
        params: params.slice(0, -2),
        containerId: params[params.length - 1] ?? "",
      };
    }
    return { params, containerId: null };
  }

  private resolveParent(
    document: Document,
    containerId: string | null,
  ): { parent: Document | Group; index: number; createdIn: string } {
    if (containerId === null) {
      return { parent: document, index: document.rootCount(), createdIn: "" };
    }
    const found = document.find(containerId);
    if (found === undefined) {
      throw new CommandError(`no such container: ${containerId}`);
    }
    const container = found.asContainer();
    if (container === null) {
      throw new CommandError(`not a container: ${containerId}`);
    }
    return {
      parent: container,
      index: container.childCount(),
      createdIn: ` in ${container.label()}`,
    };
  }

  private heldAfter(document: Document): StructureSnapshot {
    if (this.after === null || this.document !== document) {
      throw new Error("create was not executed");
    }
    return this.after;
  }
}
