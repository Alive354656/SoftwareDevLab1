import { NumberText } from "../model/NumberText";
import { restoreFieldRecords, type FieldRecord } from "../model/Shape";
import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import { requireDocument, type EditorContext } from "./EditorContext";

export class ScaleCommand extends Command {
  private executed = false;
  private before: readonly FieldRecord[] = [];
  private after: readonly FieldRecord[] = [];
  private forward = "";
  private backward = "";

  override assertUsage(): void {
    if (this.args.length !== 2) {
      throw new CommandError("usage: scale <id> <factor>");
    }
  }

  override execute(ctx: EditorContext): CommandResult {
    const document = requireDocument(ctx);
    if (this.executed) {
      restoreFieldRecords(this.after);
      return { message: this.forward, warnings: [], effect: "record" };
    }
    const shape = document.require(this.args[0] ?? "");
    const factor = NumberText.parse(this.args[1] ?? "");
    if (factor <= 0) {
      throw new CommandError("scale factor must be positive");
    }
    this.before = shape.collectFields();
    shape.scale(factor);
    this.after = shape.collectFields();
    this.forward = `${shape.label()} scaled by ${NumberText.format(factor)}`;
    this.backward = `${shape.label()} scaled back by ${NumberText.format(1 / factor)}`;
    this.executed = true;
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    if (!this.executed) {
      throw new Error("scale was not executed");
    }
    restoreFieldRecords(this.before);
    return this.backward;
  }
}
