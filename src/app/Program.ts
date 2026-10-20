import { Repl } from "../cli/Repl";
import { EditorSession } from "./EditorSession";

export class Program {
  static main(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout,
  ): void {
    const session = new EditorSession();
    void new Repl(session, input, output).run();
  }
}

Program.main();
