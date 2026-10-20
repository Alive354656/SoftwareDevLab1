import { NumberText } from "../model/NumberText";
import { restoreFieldRecords, type FieldRecord } from "../model/Shape";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class MoveCommand extends Command {
  private executed = false;
  private before: readonly FieldRecord[] = [];
  private after: readonly FieldRecord[] = [];
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length !== 3) {
      throw new CommandError("usage: move <id> <dx> <dy>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      restoreFieldRecords(this.after);
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const shape = document.require(this.args[0] ?? "");
    const dx = NumberText.parse(this.args[1] ?? "");
    const dy = NumberText.parse(this.args[2] ?? "");
    this.before = shape.collectFields();
    this.backward = shape.describeMove(dx, dy, true);
    shape.move(dx, dy);
    this.after = shape.collectFields();
    this.forward = shape.describeMove(dx, dy, false);
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    if (!this.executed) {
      throw new Error("move was not executed");
    }
    restoreFieldRecords(this.before);
    return this.backward;
  }
}
