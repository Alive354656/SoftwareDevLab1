import { ElementData } from "./ElementData";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { Shape, type FieldSnapshot } from "./Shape";

interface LineFields extends FieldSnapshot {
  readonly kind: "line";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function isLineFields(snapshot: FieldSnapshot): snapshot is LineFields {
  return snapshot.kind === "line";
}

export class Line extends Shape {
  static readonly usage =
    "usage: create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]";

  static readonly consumed: ReadonlySet<string> = new Set([
    "x1",
    "y1",
    "x2",
    "y2",
    "fill",
    "stroke",
    "stroke-width",
  ]);

  static create(id: string, params: readonly string[]): Line {
    if (params.length !== 4 && params.length !== 5) {
      throw new ModelError(Line.usage);
    }
    const line = new Line(
      id,
      NumberText.parse(params[0] ?? ""),
      NumberText.parse(params[1] ?? ""),
      NumberText.parse(params[2] ?? ""),
      NumberText.parse(params[3] ?? ""),
    );
    if (params.length === 5) {
      line.strokeValue = params[4] ?? "";
    }
    return line;
  }

  static fromElement(element: ElementData, id: string): Line {
    const line = new Line(id, 0, 0, 0, 0);
    line.loadElement(element);
    return line;
  }

  override get typeName(): string {
    return "line";
  }

  get x1(): number {
    return this.x1Value;
  }

  get y1(): number {
    return this.y1Value;
  }

  get x2(): number {
    return this.x2Value;
  }

  get y2(): number {
    return this.y2Value;
  }

  constructor(
    id: string,
    private x1Value: number,
    private y1Value: number,
    private x2Value: number,
    private y2Value: number,
  ) {
    super(id);
  }

  override move(dx: number, dy: number): void {
    this.x1Value += dx;
    this.y1Value += dy;
    this.x2Value += dx;
    this.y2Value += dy;
  }

  override captureFields(): LineFields {
    return {
      kind: "line",
      ...this.appearanceSnapshot(),
      x1: this.x1Value,
      y1: this.y1Value,
      x2: this.x2Value,
      y2: this.y2Value,
    };
  }

  override restoreFields(snapshot: FieldSnapshot): void {
    if (!isLineFields(snapshot)) {
      throw new Error("field snapshot does not match shape");
    }
    this.restoreAppearance(snapshot);
    this.x1Value = snapshot.x1;
    this.y1Value = snapshot.y1;
    this.x2Value = snapshot.x2;
    this.y2Value = snapshot.y2;
  }

  override writeSvg(indent: string): string {
    return this.voidTag(indent, [
      `x1="${NumberText.format(this.x1Value)}"`,
      `y1="${NumberText.format(this.y1Value)}"`,
      `x2="${NumberText.format(this.x2Value)}"`,
      `y2="${NumberText.format(this.y2Value)}"`,
    ]);
  }

  protected override applyScale(factor: number): void {
    this.x1Value *= factor;
    this.y1Value *= factor;
    this.x2Value *= factor;
    this.y2Value *= factor;
  }

  protected override assignOwnAttribute(name: string, value: string): boolean {
    if (name === "x1") {
      this.x1Value = NumberText.parse(value);
      return true;
    }
    if (name === "y1") {
      this.y1Value = NumberText.parse(value);
      return true;
    }
    if (name === "x2") {
      this.x2Value = NumberText.parse(value);
      return true;
    }
    if (name === "y2") {
      this.y2Value = NumberText.parse(value);
      return true;
    }
    return false;
  }

  protected override treeDetail(): string {
    const geometry = `(${NumberText.format(this.x1Value)},${NumberText.format(this.y1Value)}) -> (${NumberText.format(this.x2Value)},${NumberText.format(this.y2Value)})`;
    return this.joinDetail(geometry);
  }

  protected override showLines(): string[] {
    return [
      `x1=${NumberText.format(this.x1Value)} y1=${NumberText.format(this.y1Value)} x2=${NumberText.format(this.x2Value)} y2=${NumberText.format(this.y2Value)}`,
      ...super.showLines(),
    ];
  }

  private loadElement(element: ElementData): void {
    this.rejectChildElements(element);
    this.x1Value = this.requiredNumber(element, "x1");
    this.y1Value = this.requiredNumber(element, "y1");
    this.x2Value = this.requiredNumber(element, "x2");
    this.y2Value = this.requiredNumber(element, "y2");
    this.readAppearance(element);
  }
}
