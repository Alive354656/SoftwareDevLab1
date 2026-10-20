import { ElementData } from "./ElementData";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { Shape, type FieldSnapshot } from "./Shape";

interface RectFields extends FieldSnapshot {
  readonly kind: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function isRectFields(snapshot: FieldSnapshot): snapshot is RectFields {
  return snapshot.kind === "rect";
}

export class Rect extends Shape {
  static readonly usage =
    "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]";

  static readonly consumed: ReadonlySet<string> = new Set([
    "x",
    "y",
    "width",
    "height",
    "fill",
    "stroke",
    "stroke-width",
  ]);

  static create(id: string, params: readonly string[]): Rect {
    if (params.length !== 4 && params.length !== 5) {
      throw new ModelError(Rect.usage);
    }
    const rect = new Rect(
      id,
      NumberText.parse(params[0] ?? ""),
      NumberText.parse(params[1] ?? ""),
      NumberText.parse(params[2] ?? ""),
      NumberText.parse(params[3] ?? ""),
    );
    if (params.length === 5) {
      rect.fillValue = params[4] ?? "";
    }
    return rect;
  }

  static fromElement(element: ElementData, id: string): Rect {
    const rect = new Rect(id, 0, 0, 0, 0);
    rect.loadElement(element);
    return rect;
  }

  override get typeName(): string {
    return "rect";
  }

  get x(): number {
    return this.xValue;
  }

  get y(): number {
    return this.yValue;
  }

  get width(): number {
    return this.widthValue;
  }

  get height(): number {
    return this.heightValue;
  }

  constructor(
    id: string,
    private xValue: number,
    private yValue: number,
    private widthValue: number,
    private heightValue: number,
  ) {
    super(id);
  }

  override move(dx: number, dy: number): void {
    this.xValue += dx;
    this.yValue += dy;
  }

  override captureFields(): RectFields {
    return {
      kind: "rect",
      ...this.appearanceSnapshot(),
      x: this.xValue,
      y: this.yValue,
      width: this.widthValue,
      height: this.heightValue,
    };
  }

  override restoreFields(snapshot: FieldSnapshot): void {
    if (!isRectFields(snapshot)) {
      throw new Error("field snapshot does not match shape");
    }
    this.restoreAppearance(snapshot);
    this.xValue = snapshot.x;
    this.yValue = snapshot.y;
    this.widthValue = snapshot.width;
    this.heightValue = snapshot.height;
  }

  override writeSvg(indent: string): string {
    return this.voidTag(indent, [
      `x="${NumberText.format(this.xValue)}"`,
      `y="${NumberText.format(this.yValue)}"`,
      `width="${NumberText.format(this.widthValue)}"`,
      `height="${NumberText.format(this.heightValue)}"`,
    ]);
  }

  protected override applyScale(factor: number): void {
    this.xValue *= factor;
    this.yValue *= factor;
    this.widthValue *= factor;
    this.heightValue *= factor;
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
    if (name === "width") {
      this.widthValue = NumberText.parse(value);
      return true;
    }
    if (name === "height") {
      this.heightValue = NumberText.parse(value);
      return true;
    }
    return false;
  }

  protected override treeDetail(): string {
    return this.joinDetail(
      `x=${NumberText.format(this.xValue)} y=${NumberText.format(this.yValue)} w=${NumberText.format(this.widthValue)} h=${NumberText.format(this.heightValue)}`,
    );
  }

  protected override showLines(): string[] {
    return [
      `x=${NumberText.format(this.xValue)} y=${NumberText.format(this.yValue)} width=${NumberText.format(this.widthValue)} height=${NumberText.format(this.heightValue)}`,
      ...super.showLines(),
    ];
  }

  private loadElement(element: ElementData): void {
    this.rejectChildElements(element);
    this.xValue = this.requiredNumber(element, "x");
    this.yValue = this.requiredNumber(element, "y");
    this.widthValue = this.requiredNumber(element, "width");
    this.heightValue = this.requiredNumber(element, "height");
    this.readAppearance(element);
  }
}
