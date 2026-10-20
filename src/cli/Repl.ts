import readline from "node:readline";

export interface LineSource {
  executeLine(line: string): readonly string[];
}

export class Repl {
  static readonly BANNER = "svg-editor 0.1 \u2014 type 'help' for commands";
  static readonly PROMPT = "svg> ";

  constructor(
    private readonly lines: LineSource,
    private readonly input: NodeJS.ReadableStream,
    private readonly output: NodeJS.WritableStream,
  ) {}

  run(): Promise<void> {
    this.output.write(`${Repl.BANNER}\n\n`);
    const reader = readline.createInterface({
      input: this.input,
      output: this.output,
      prompt: Repl.PROMPT,
    });
    reader.on("line", (line) => {
      if (!this.isInteractive()) {
        this.output.write("\n");
      }
      for (const item of this.lines.executeLine(line)) {
        this.output.write(`${item}\n`);
      }
      reader.prompt();
    });
    return new Promise((resolve) => {
      reader.on("close", () => resolve());
      reader.prompt();
    });
  }

  private isInteractive(): boolean {
    return "isTTY" in this.output && this.output.isTTY === true;
  }
}
