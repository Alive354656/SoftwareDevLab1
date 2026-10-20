import { LineSyntaxError } from "./LineSyntaxError";
import { ParsedLine } from "./ParsedLine";

export class CommandLineParser {
  parse(line: string): ParsedLine | null {
    if (this.isBlankOrComment(line)) {
      return null;
    }
    const tokens = this.tokenize(line);
    if (tokens.length === 0) {
      return null;
    }
    const [name, ...args] = tokens;
    return new ParsedLine(name, args);
  }

  private isBlankOrComment(line: string): boolean {
    let start = 0;
    let end = line.length;
    while (start < end && this.isSeparator(line[start])) {
      start += 1;
    }
    while (end > start && this.isSeparator(line[end - 1])) {
      end -= 1;
    }
    return start === end || line[start] === "#";
  }

  private tokenize(line: string): string[] {
    const tokens: string[] = [];
    let index = 0;
    while (index < line.length) {
      while (index < line.length && this.isSeparator(line[index])) {
        index += 1;
      }
      if (index >= line.length) {
        break;
      }
      if (line[index] === '"') {
        const start = index + 1;
        const closing = line.indexOf('"', start);
        if (closing < 0) {
          throw new LineSyntaxError("unclosed quote");
        }
        tokens.push(line.slice(start, closing));
        index = closing + 1;
        continue;
      }
      const start = index;
      while (index < line.length && !this.isSeparator(line[index])) {
        index += 1;
      }
      tokens.push(line.slice(start, index));
    }
    return tokens;
  }

  private isSeparator(character: string): boolean {
    return character === " " || character === "\t";
  }
}
