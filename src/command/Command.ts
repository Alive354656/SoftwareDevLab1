import type { EditorContext } from "./EditorContext";

export interface CommandResult {
  readonly message: string;
  readonly warnings: readonly string[];
  readonly effect: "record" | "reset" | "lock" | "none";
}

export abstract class Command {
  readonly meta: "undo" | "redo" | null = null;

  constructor(protected readonly args: readonly string[]) {}

  get needsDocument(): boolean {
    return true;
  }

  assertUsage(): void {}

  execute(_ctx: EditorContext): CommandResult {
    throw new Error(`not implemented: ${this.constructor.name}`);
  }

  undo(): string {
    throw new Error(`not implemented: undo ${this.constructor.name}`);
  }
}
