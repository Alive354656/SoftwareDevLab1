import { ElementData } from "./ElementData";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { Shape, type FieldSnapshot } from "./Shape";
import { XmlText } from "./XmlText";

interface TextFields extends FieldSnapshot {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly content: string;
}

function isTextFields(snapshot: FieldSnapshot): snapshot is TextFields {
  return snapshot.kind === "text";
}

export class Text extends Shape {
  static readonly usage = 'usage: create text <id> <x> <y> "content" [in <containerId>]';

  static readonly consumed: ReadonlySet<string> = new Set([
    "x",
    "y",
    "fill",
    "stroke",
    "stroke-width",
  ]);

  static create(id: string, params: readonly string[]): Text {
    if (params.length !== 3) {
      throw new ModelError(Text.usage);
    }
    return new Text(
      id,
      NumberText.parse(params[0] ?? ""),
      NumberText.parse(params[1] ?? ""),
      params[2] ?? "",
    );
  }

  static fromElement(element: ElementData, id: string): Text {
    const text = new Text(id, 0, 0, "");
    text.loadElement(element);
    return text;
  }

  override get typeName(): string {
    return "text";
  }

  get x(): number {
    return this.xValue;
  }

  get y(): number {
    return this.yValue;
  }

  get content(): string {
    return this.contentValue;
  }

  constructor(
    id: string,
    private xValue: number,
    private yValue: number,
    private contentValue: string,
  ) {
    super(id);
  }

  override move(dx: number, dy: number): void {
    this.xValue += dx;
    this.yValue += dy;
  }

  override captureFields(): TextFields {
    return {
      kind: "text",
      ...this.appearanceSnapshot(),
      x: this.xValue,
      y: this.yValue,
      content: this.contentValue,
    };
  }

  override restoreFields(snapshot: FieldSnapshot): void {
    if (!isTextFields(snapshot)) {
      throw new Error("field snapshot does not match shape");
    }
    this.restoreAppearance(snapshot);
    this.xValue = snapshot.x;
    this.yValue = snapshot.y;
    this.contentValue = snapshot.content;
  }

  override writeSvg(indent: string): string {
    const attributes = [
      `id="${XmlText.escapeAttribute(this.id)}"`,
      `x="${NumberText.format(this.xValue)}"`,
      `y="${NumberText.format(this.yValue)}"`,
      ...this.appearanceAttributes(),
    ];
    return `${indent}<text ${attributes.join(" ")}>${XmlText.escapeText(this.contentValue)}</text>`;
  }

  protected override applyScale(factor: number): void {
    this.xValue *= factor;
    this.yValue *= factor;
  }

  protected override assignOwnAttribute(name: string, value: string): boolean {
    if (name === "x") {
      this.xValue = NumberText.parse(value);
      return true;
    }
    if (name === "y") {
      this.yValue = NumberText.parse(value);
      return true;
    }
    if (name === "text") {
      this.contentValue = value;
      return true;
    }
    return false;
  }

  protected override treeDetail(): string {
    return this.joinDetail(
      `(${NumberText.format(this.xValue)},${NumberText.format(this.yValue)}) "${this.displayContent()}"`,
    );
  }

  protected override showLines(): string[] {
    return [
      `x=${NumberText.format(this.xValue)} y=${NumberText.format(this.yValue)}`,
      `text="${this.displayContent()}"`,
      ...super.showLines(),
    ];
  }

  private loadElement(element: ElementData): void {
    this.rejectChildElements(element);
    this.xValue = this.requiredNumber(element, "x");
    this.yValue = this.requiredNumber(element, "y");
    this.contentValue = element.text;
    this.readAppearance(element);
  }

  private displayContent(): string {
    return this.contentValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }
}
