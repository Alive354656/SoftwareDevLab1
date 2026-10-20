import type { Document } from "./Document";
import { ElementData } from "./ElementData";
import { ModelError } from "./ModelError";
import { Shape, type FieldSnapshot } from "./Shape";
import { XmlText } from "./XmlText";

export class Group extends Shape {
  static readonly usage = "usage: create g <id> [in <containerId>]";

  static readonly consumed: ReadonlySet<string> = new Set(["fill", "stroke", "stroke-width"]);

  private readonly childList: Shape[] = [];

  static create(id: string, params: readonly string[]): Group {
    if (params.length !== 0) {
      throw new ModelError(Group.usage);
    }
    return new Group(id);
  }

  static fromElement(element: ElementData, id: string): Group {
    // 子元素由读取器逐层创建。工厂不递归，也不把子元素当成不支持的标签。
    const group = new Group(id);
    group.readAppearance(element);
    return group;
  }

  override get typeName(): string {
    return "g";
  }

  constructor(id: string) {
    super(id);
  }

  ownerLabel(): string {
    return `g#${this.id}`;
  }

  childCount(): number {
    return this.childList.length;
  }

  copyChildren(): readonly Shape[] {
    return this.childList.slice();
  }

  insertChild(shape: Shape, index: number): void {
    if (index < 0 || index > this.childList.length) {
      throw new Error("index out of range");
    }
    this.childList.splice(index, 0, shape);
  }

  removeChild(shape: Shape): void {
    const index = this.childList.indexOf(shape);
    if (index < 0) {
      throw new Error("shape is not a child of this parent");
    }
    this.childList.splice(index, 1);
  }

  replaceChildren(children: readonly Shape[]): void {
    this.childList.length = 0;
    this.childList.push(...children);
  }

  override move(dx: number, dy: number): void {
    for (const child of this.childList) {
      child.move(dx, dy);
    }
  }

  override captureFields(): FieldSnapshot {
    return { kind: "g", ...this.appearanceSnapshot() };
  }

  override restoreFields(snapshot: FieldSnapshot): void {
    if (snapshot.kind !== "g") {
      throw new Error("field snapshot does not match shape");
    }
    this.restoreAppearance(snapshot);
  }

  override writeSvg(indent: string): string {
    const attributes = [`id="${XmlText.escapeAttribute(this.id)}"`, ...this.appearanceAttributes()];
    const opening = `${indent}<g ${attributes.join(" ")}`;
    if (this.childList.length === 0) {
      return `${opening}/>`;
    }
    const inner = this.childList.map(child => child.writeSvg(`${indent}  `)).join("\n");
    return `${opening}>\n${inner}\n${indent}</g>`;
  }

  override assignParent(parent: Document | Group): void {
    super.assignParent(parent);
    for (const child of this.childList) {
      child.assignParent(this);
    }
  }

  override forEachChild(visit: (child: Shape) => void): void {
    for (const child of this.childList) {
      visit(child);
    }
  }

  override collectGroups(groups: Group[]): void {
    groups.push(this);
    for (const child of this.childList) {
      child.collectGroups(groups);
    }
  }

  protected override applyScale(factor: number): void {
    for (const child of this.childList) {
      child.scale(factor);
    }
  }

  protected override showLines(): string[] {
    return [`children=${this.childList.length}`, ...super.showLines()];
  }
}
