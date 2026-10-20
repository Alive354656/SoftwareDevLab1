export class LineSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineSyntaxError";
  }
}
