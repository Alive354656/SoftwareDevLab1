import { Command } from "./Command";

export class UndoCommand extends Command {
  override readonly meta: "undo" = "undo";
}
