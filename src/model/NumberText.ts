import { ModelError } from "./ModelError";

export class NumberText {
  static parse(token: string): number {
    if (token === "") {
      throw new ModelError("invalid number: ");
    }
    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new ModelError(`invalid number: ${token}`);
    }
    return Object.is(value, -0) ? 0 : value;
  }

  static format(value: number): string {
    if (!Number.isFinite(value)) {
      throw new ModelError(`invalid number: ${value}`);
    }
    let text = value.toFixed(8);
    if (text.startsWith("-") && Number(text) === 0) {
      text = text.slice(1);
    }
    text = text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    return text;
  }
}
