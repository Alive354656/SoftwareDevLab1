import { Command } from "./Command";

export class RedoCommand extends Command {
  override readonly meta: "redo" = "redo";
}
