import type { Document } from "./Document";
import { ElementData } from "./ElementData";
import type { Group } from "./Group";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { TreeNode } from "./TreeNode";
import { XmlText } from "./XmlText";

export interface FieldSnapshot {
  readonly kind: string;
  readonly fill: string | undefined;
  readonly stroke: string | undefined;
  readonly strokeWidth: number | undefined;
}

export interface FieldRecord {
  readonly shape: Shape;
  readonly fields: FieldSnapshot;
}

export abstract class Shape {
  private parentNode: Document | Group | null = null;
  protected fillValue: string | undefined;
  protected strokeValue: string | undefined;
  protected strokeWidthValue: number | undefined;

  constructor(readonly id: string) {}

  abstract get typeName(): string;

  get parent(): Document | Group | null {
    return this.parentNode;
  }

  get fill(): string | undefined {
    return this.fillValue;
  }

  get stroke(): string | undefined {
    return this.strokeValue;
  }

  get strokeWidth(): number | undefined {
    return this.strokeWidthValue;
  }

  abstract move(dx: number, dy: number): void;

  scale(factor: number): void {
    if (!Number.isFinite(factor) || !(factor > 0)) {
      throw new ModelError("scale factor must be positive");
    }
    this.applyScale(factor);
  }

  setAttribute(name: string, value: string): void {
    if (this.assignOwnAttribute(name, value)) {
      return;
    }
    if (name === "fill") {
      this.fillValue = value;
      return;
    }
    if (name === "stroke") {
      this.strokeValue = value;
      return;
    }
    if (name === "stroke-width") {
      this.strokeWidthValue = NumberText.parse(value);
      return;
    }
    throw new ModelError(`unknown attribute: ${name}`);
  }

  // 叶子给出当前锚点；组没有坐标，返回 null，文案改用位移。
  describeMove(dx: number, dy: number, undone: boolean): string {
    const point = this.anchorText();
    if (point === null) {
      const x = undone ? -dx : dx;
      const y = undone ? -dy : dy;
      const verb = undone ? "moved back by" : "moved by";
      return `${this.label()} ${verb} (${NumberText.format(x)},${NumberText.format(y)})`;
    }
    const verb = undone ? "moved back to" : "moved to";
    return `${this.label()} ${verb} ${point}`;
  }

  assignmentText(name: string): string | undefined {
    const geometry = this.geometryAssignment(name);
    if (geometry !== undefined) {
      return geometry;
    }
    return this.appearanceAssignment(name);
  }

  collectFields(): FieldRecord[] {
    const records: FieldRecord[] = [];
    this.collectFieldRecords(records);
    return records;
  }

  asContainer(): Group | null {
    return null;
  }

  // 沿父指针向上找。Document 不是 Shape，走到画布就停；自己不算自己的子孙。
  encloses(descendant: Shape): boolean {
    const self: Shape = this;
    let owner: Document | Group | null = descendant.parent;
    while (owner instanceof Shape) {
      if (owner === self) {
        return true;
      }
      owner = owner.parent;
    }
    return false;
  }

  abstract captureFields(): FieldSnapshot;

  abstract restoreFields(snapshot: FieldSnapshot): void;

  abstract writeSvg(indent: string): string;

  label(): string {
    return `${this.typeName}#${this.id}`;
  }

  toTreeNode(): TreeNode {
    const children: TreeNode[] = [];
    this.forEachChild(child => {
      children.push(child.toTreeNode());
    });
    return new TreeNode(this.label(), this.treeDetail(), children);
  }

  renderShow(): string {
    const parent = this.parentNode;
    if (parent === null) {
      throw new ModelError(`no such shape: ${this.id}`);
    }
    const lines = [`${this.label()}  parent=${parent.ownerLabel()}`];
    for (const line of this.showLines()) {
      lines.push(`  ${line}`);
    }
    return lines.join("\n");
  }

  assignParent(parent: Document | Group): void {
    this.parentNode = parent;
  }

  clearParent(): void {
    this.parentNode = null;
  }

  forEachChild(_visit: (child: Shape) => void): void {}

  collectGroups(_groups: Group[]): void {}

  protected abstract applyScale(factor: number): void;

  protected anchorText(): string | null {
    return null;
  }

  protected geometryAssignment(_name: string): string | undefined {
    return undefined;
  }

  protected assignOwnAttribute(_name: string, _value: string): boolean {
    return false;
  }

  protected treeDetail(): string {
    return this.appearanceDetail();
  }

  protected showLines(): string[] {
    const appearance = this.appearanceDetail();
    return appearance === "" ? [] : [appearance];
  }

  protected joinDetail(geometry: string): string {
    const appearance = this.appearanceDetail();
    return appearance === "" ? geometry : `${geometry} ${appearance}`;
  }

  protected appearanceSnapshot(): Pick<FieldSnapshot, "fill" | "stroke" | "strokeWidth"> {
    return {
      fill: this.fillValue,
      stroke: this.strokeValue,
      strokeWidth: this.strokeWidthValue,
    };
  }

  protected restoreAppearance(snapshot: FieldSnapshot): void {
    this.fillValue = snapshot.fill;
    this.strokeValue = snapshot.stroke;
    this.strokeWidthValue = snapshot.strokeWidth;
  }

  protected voidTag(indent: string, geometry: readonly string[]): string {
    const attributes = [
      `id="${XmlText.escapeAttribute(this.id)}"`,
      ...geometry,
      ...this.appearanceAttributes(),
    ];
    return `${indent}<${this.typeName} ${attributes.join(" ")}/>`;
  }

  protected readAppearance(element: ElementData): void {
    const fill = element.attribute("fill");
    if (fill !== undefined) {
      this.fillValue = fill;
    }
    const stroke = element.attribute("stroke");
    if (stroke !== undefined) {
      this.strokeValue = stroke;
    }
    const strokeWidth = element.attribute("stroke-width");
    if (strokeWidth !== undefined) {
      this.strokeWidthValue = NumberText.parse(strokeWidth);
    }
  }

  protected requiredNumber(element: ElementData, name: string): number {
    const value = element.attribute(name);
    if (value === undefined) {
      throw new ModelError(`invalid svg: missing attribute: ${name}`);
    }
    return NumberText.parse(value);
  }

  protected rejectChildElements(element: ElementData): void {
    const child = element.children[0];
    if (child !== undefined) {
      throw new ModelError(`unsupported element: ${child.tag}`);
    }
  }

  private collectFieldRecords(records: FieldRecord[]): void {
    records.push({ shape: this, fields: this.captureFields() });
    this.forEachChild(child => child.collectFieldRecords(records));
  }

  private appearanceAssignment(name: string): string | undefined {
    if (name === "fill") {
      return this.fillValue === undefined ? undefined : `fill=${this.fillValue}`;
    }
    if (name === "stroke") {
      return this.strokeValue === undefined ? undefined : `stroke=${this.strokeValue}`;
    }
    if (name === "stroke-width") {
      return this.strokeWidthValue === undefined
        ? undefined
        : `stroke-width=${NumberText.format(this.strokeWidthValue)}`;
    }
    return undefined;
  }

  private appearanceDetail(): string {
    const parts: string[] = [];
    if (this.fillValue !== undefined) {
      parts.push(`fill=${this.fillValue}`);
    }
    if (this.strokeValue !== undefined) {
      parts.push(`stroke=${this.strokeValue}`);
    }
    if (this.strokeWidthValue !== undefined) {
      parts.push(`stroke-width=${NumberText.format(this.strokeWidthValue)}`);
    }
    return parts.join(" ");
  }

  protected appearanceAttributes(): string[] {
    const attributes: string[] = [];
    if (this.fillValue !== undefined) {
      attributes.push(`fill="${XmlText.escapeAttribute(this.fillValue)}"`);
    }
    if (this.strokeValue !== undefined) {
      attributes.push(`stroke="${XmlText.escapeAttribute(this.strokeValue)}"`);
    }
    if (this.strokeWidthValue !== undefined) {
      attributes.push(`stroke-width="${NumberText.format(this.strokeWidthValue)}"`);
    }
    return attributes;
  }
}

export function restoreFieldRecords(records: readonly FieldRecord[]): void {
  for (const record of records) {
    record.shape.restoreFields(record.fields);
  }
}
