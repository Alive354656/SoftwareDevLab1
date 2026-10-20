import { Command, type CommandResult } from "./Command";
import { CommandError } from "./CommandError";
import type { EditorContext } from "./EditorContext";

export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private lockedValue = false;

  get undoDepth(): number {
    return this.undoStack.length;
  }

  get redoDepth(): number {
    return this.redoStack.length;
  }

  get locked(): boolean {
    return this.lockedValue;
  }

  apply(effect: CommandResult["effect"], command: Command): void {
    if (effect === "record") {
      this.undoStack.push(command);
      this.redoStack.length = 0;
      this.lockedValue = false;
      return;
    }
    if (effect === "reset") {
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.lockedValue = true;
      return;
    }
    if (effect === "lock") {
      this.lockedValue = true;
      this.redoStack.length = 0;
    }
  }

  undo(): string {
    if (this.lockedValue) {
      throw new CommandError("undo not allowed after io command");
    }
    const command = this.undoStack.pop();
    if (command === undefined) {
      throw new CommandError("nothing to undo");
    }
    try {
      const message = command.undo();
      this.redoStack.push(command);
      return message;
    } catch (error) {
      this.undoStack.push(command);
      throw error;
    }
  }

  // 第二次 execute 恢复该命令自己记下的「之后」快照，这里不再解释 effect。
  redo(ctx: EditorContext): string {
    if (this.lockedValue) {
      throw new CommandError("undo not allowed after io command");
    }
    const command = this.redoStack.pop();
    if (command === undefined) {
      throw new CommandError("nothing to redo");
    }
    try {
      const result = command.execute(ctx);
      this.undoStack.push(command);
      return result.message;
    } catch (error) {
      this.redoStack.push(command);
      throw error;
    }
  }
}
