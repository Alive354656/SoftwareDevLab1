import { ElementData } from "./ElementData";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { Shape, type FieldSnapshot } from "./Shape";

interface EllipseFields extends FieldSnapshot {
  readonly kind: "ellipse";
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

function isEllipseFields(snapshot: FieldSnapshot): snapshot is EllipseFields {
  return snapshot.kind === "ellipse";
}

export class Ellipse extends Shape {
  static readonly usage =
    "usage: create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]";

  static readonly consumed: ReadonlySet<string> = new Set([
    "cx",
    "cy",
    "rx",
    "ry",
    "fill",
    "stroke",
    "stroke-width",
  ]);

  static create(id: string, params: readonly string[]): Ellipse {
    if (params.length !== 4 && params.length !== 5) {
      throw new ModelError(Ellipse.usage);
    }
    const ellipse = new Ellipse(
      id,
      NumberText.parse(params[0] ?? ""),
      NumberText.parse(params[1] ?? ""),
      NumberText.parse(params[2] ?? ""),
      NumberText.parse(params[3] ?? ""),
    );
    if (params.length === 5) {
      ellipse.fillValue = params[4] ?? "";
    }
    return ellipse;
  }

  static fromElement(element: ElementData, id: string): Ellipse {
    const ellipse = new Ellipse(id, 0, 0, 0, 0);
    ellipse.loadElement(element);
    return ellipse;
  }

  override get typeName(): string {
    return "ellipse";
  }

  get cx(): number {
    return this.cxValue;
  }

  get cy(): number {
    return this.cyValue;
  }

  get rx(): number {
    return this.rxValue;
  }

  get ry(): number {
    return this.ryValue;
  }

  constructor(
    id: string,
    private cxValue: number,
    private cyValue: number,
    private rxValue: number,
    private ryValue: number,
  ) {
    super(id);
  }

  override move(dx: number, dy: number): void {
    this.cxValue += dx;
    this.cyValue += dy;
  }

  override captureFields(): EllipseFields {
    return {
      kind: "ellipse",
      ...this.appearanceSnapshot(),
      cx: this.cxValue,
      cy: this.cyValue,
      rx: this.rxValue,
      ry: this.ryValue,
    };
  }

  override restoreFields(snapshot: FieldSnapshot): void {
    if (!isEllipseFields(snapshot)) {
      throw new Error("field snapshot does not match shape");
    }
    this.restoreAppearance(snapshot);
    this.cxValue = snapshot.cx;
    this.cyValue = snapshot.cy;
    this.rxValue = snapshot.rx;
    this.ryValue = snapshot.ry;
  }

  override writeSvg(indent: string): string {
    return this.voidTag(indent, [
      `cx="${NumberText.format(this.cxValue)}"`,
      `cy="${NumberText.format(this.cyValue)}"`,
      `rx="${NumberText.format(this.rxValue)}"`,
      `ry="${NumberText.format(this.ryValue)}"`,
    ]);
  }

  protected override applyScale(factor: number): void {
    this.cxValue *= factor;
    this.cyValue *= factor;
    this.rxValue *= factor;
    this.ryValue *= factor;
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
    if (name === "rx") {
      this.rxValue = NumberText.parse(value);
      return true;
    }
    if (name === "ry") {
      this.ryValue = NumberText.parse(value);
      return true;
    }
    return false;
  }

  protected override treeDetail(): string {
    return this.joinDetail(
      `cx=${NumberText.format(this.cxValue)} cy=${NumberText.format(this.cyValue)} rx=${NumberText.format(this.rxValue)} ry=${NumberText.format(this.ryValue)}`,
    );
  }

  protected override showLines(): string[] {
    return [
      `cx=${NumberText.format(this.cxValue)} cy=${NumberText.format(this.cyValue)} rx=${NumberText.format(this.rxValue)} ry=${NumberText.format(this.ryValue)}`,
      ...super.showLines(),
    ];
  }

  private loadElement(element: ElementData): void {
    this.rejectChildElements(element);
    this.cxValue = this.requiredNumber(element, "cx");
    this.cyValue = this.requiredNumber(element, "cy");
    this.rxValue = this.requiredNumber(element, "rx");
    this.ryValue = this.requiredNumber(element, "ry");
    this.readAppearance(element);
  }
}
