import { AddToCommand } from "./AddToCommand";
import { BackCommand } from "./BackCommand";
import { CanvasCommand } from "./CanvasCommand";
import type { Command } from "./Command";
import { CommandError } from "./CommandError";
import { CreateCommand } from "./CreateCommand";
import { DeleteCommand } from "./DeleteCommand";
import { FrontCommand } from "./FrontCommand";
import { GroupCommand } from "./GroupCommand";
import { HelpCommand } from "./HelpCommand";
import { InitCommand } from "./InitCommand";
import { MoveCommand } from "./MoveCommand";
import { ReadCommand } from "./ReadCommand";
import { RedoCommand } from "./RedoCommand";
import { SaveCommand } from "./SaveCommand";
import { ScaleCommand } from "./ScaleCommand";
import { SetCommand } from "./SetCommand";
import { ShowCommand } from "./ShowCommand";
import { TreeCommand } from "./TreeCommand";
import { UndoCommand } from "./UndoCommand";
import { UngroupCommand } from "./UngroupCommand";

type CommandConstructor = new (args: readonly string[]) => Command;

export class CommandRegistry {
  // 待重构：命令名到命令类的映射是本系统仅有的两处按名字分发之一。
  // 新命令目前要改这个表；后续若要插件化，应改为登记，而不是继续加分支。
  private static readonly factories = new Map<string, CommandConstructor>([
    ["init", InitCommand],
    ["read", ReadCommand],
    ["save", SaveCommand],
    ["canvas", CanvasCommand],
    ["create", CreateCommand],
    ["delete", DeleteCommand],
    ["move", MoveCommand],
    ["scale", ScaleCommand],
    ["set", SetCommand],
    ["group", GroupCommand],
    ["ungroup", UngroupCommand],
    ["addto", AddToCommand],
    ["front", FrontCommand],
    ["back", BackCommand],
    ["tree", TreeCommand],
    ["show", ShowCommand],
    ["help", HelpCommand],
    ["undo", UndoCommand],
    ["redo", RedoCommand],
  ]);

  create(name: string, args: readonly string[]): Command {
    const CommandClass = CommandRegistry.factories.get(name);
    if (CommandClass === undefined) {
      throw new CommandError(`unknown command: ${name}`);
    }
    return new CommandClass(args);
  }
}
