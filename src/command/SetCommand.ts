import { restoreFieldRecords, type FieldRecord } from "../model/Shape";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class SetCommand extends Command {
  private executed = false;
  private before: readonly FieldRecord[] = [];
  private after: readonly FieldRecord[] = [];
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length !== 3) {
      throw new CommandError("usage: set <id> <attr> <value>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      restoreFieldRecords(this.after);
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const shape = document.require(this.args[0] ?? "");
    const name = this.args[1] ?? "";
    const value = this.args[2] ?? "";
    const previous = shape.assignmentText(name);
    this.before = shape.collectFields();
    shape.setAttribute(name, value);
    const next = shape.assignmentText(name);
    if (next === undefined) {
      restoreFieldRecords(this.before);
      throw new Error("set did not store the attribute");
    }
    this.after = shape.collectFields();
    this.forward = `${shape.label()} updated: ${next}`;
    this.backward = `${shape.label()} updated: ${previous ?? `${name} removed`}`;
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    if (!this.executed) {
      throw new Error("set was not executed");
    }
    restoreFieldRecords(this.before);
    return this.backward;
  }
}
