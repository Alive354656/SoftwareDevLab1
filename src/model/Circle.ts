import { ElementData } from "./ElementData";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { Shape, type FieldSnapshot } from "./Shape";

interface CircleFields extends FieldSnapshot {
  readonly kind: "circle";
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

function isCircleFields(snapshot: FieldSnapshot): snapshot is CircleFields {
  return snapshot.kind === "circle";
}

export class Circle extends Shape {
  static readonly usage =
    "usage: create circle <id> <cx> <cy> <r> [fill] [in <containerId>]";

  static readonly consumed: ReadonlySet<string> = new Set([
    "cx",
    "cy",
    "r",
    "fill",
    "stroke",
    "stroke-width",
  ]);

  static create(id: string, params: readonly string[]): Circle {
    if (params.length !== 3 && params.length !== 4) {
      throw new ModelError(Circle.usage);
    }
    const circle = new Circle(
      id,
      NumberText.parse(params[0] ?? ""),
      NumberText.parse(params[1] ?? ""),
      NumberText.parse(params[2] ?? ""),
    );
    if (params.length === 4) {
      circle.fillValue = params[3] ?? "";
    }
    return circle;
  }

  static fromElement(element: ElementData, id: string): Circle {
    const circle = new Circle(id, 0, 0, 0);
    circle.loadElement(element);
    return circle;
  }

  override get typeName(): string {
    return "circle";
  }

  get cx(): number {
    return this.cxValue;
  }

  get cy(): number {
    return this.cyValue;
  }

  get r(): number {
    return this.rValue;
  }

  constructor(
    id: string,
    private cxValue: number,
    private cyValue: number,
    private rValue: number,
  ) {
    super(id);
  }

  override move(dx: number, dy: number): void {
    this.cxValue += dx;
    this.cyValue += dy;
  }

  protected override anchorText(): string {
    return `(${NumberText.format(this.cxValue)},${NumberText.format(this.cyValue)})`;
  }

  protected override geometryAssignment(name: string): string | undefined {
    if (name === "cx") {
      return `cx=${NumberText.format(this.cxValue)}`;
    }
    if (name === "cy") {
      return `cy=${NumberText.format(this.cyValue)}`;
    }
    if (name === "r") {
      return `r=${NumberText.format(this.rValue)}`;
    }
    return undefined;
  }

  override captureFields(): CircleFields {
    return {
      kind: "circle",
      ...this.appearanceSnapshot(),
      cx: this.cxValue,
      cy: this.cyValue,
      r: this.rValue,
    };
  }

  override restoreFields(snapshot: FieldSnapshot): void {
    if (!isCircleFields(snapshot)) {
      throw new Error("field snapshot does not match shape");
    }
    this.restoreAppearance(snapshot);
    this.cxValue = snapshot.cx;
    this.cyValue = snapshot.cy;
    this.rValue = snapshot.r;
  }

  override writeSvg(indent: string): string {
    return this.voidTag(indent, [
      `cx="${NumberText.format(this.cxValue)}"`,
      `cy="${NumberText.format(this.cyValue)}"`,
      `r="${NumberText.format(this.rValue)}"`,
    ]);
  }

  protected override applyScale(factor: number): void {
    this.cxValue *= factor;
    this.cyValue *= factor;
    this.rValue *= factor;
  }

  protected override assignOwnAttribute(name: string, value: string): boolean {
    if (name === "cx") {
      this.cxValue = NumberText.parse(value);
      return true;
    }
    if (name === "cy") {
      this.cyValue = NumberText.parse(value);
      return true;
    }
    if (name === "r") {
      this.rValue = NumberText.parse(value);
      return true;
    }
    return false;
  }

  protected override treeDetail(): string {
    return this.joinDetail(
      `cx=${NumberText.format(this.cxValue)} cy=${NumberText.format(this.cyValue)} r=${NumberText.format(this.rValue)}`,
    );
  }

  protected override showLines(): string[] {
    return [
      `cx=${NumberText.format(this.cxValue)} cy=${NumberText.format(this.cyValue)} r=${NumberText.format(this.rValue)}`,
      ...super.showLines(),
    ];
  }

  private loadElement(element: ElementData): void {
    this.rejectChildElements(element);
    this.cxValue = this.requiredNumber(element, "cx");
    this.cyValue = this.requiredNumber(element, "cy");
    this.rValue = this.requiredNumber(element, "r");
    this.readAppearance(element);
  }
}
