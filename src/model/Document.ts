import { Group } from "./Group";
import { ModelError } from "./ModelError";
import { NumberText } from "./NumberText";
import { Shape } from "./Shape";
import { TreeNode } from "./TreeNode";
import { TreeText } from "./TreeText";

export interface StructureSnapshot {
  readonly roots: readonly Shape[];
  readonly groups: ReadonlyMap<Group, readonly Shape[]>;
}

export class Document {
  private widthValue = 0;
  private heightValue = 0;
  private readonly roots: Shape[] = [];
  private index = new Map<string, Shape>();

  constructor(width: number, height: number) {
    this.resize(width, height);
  }

  get width(): number {
    return this.widthValue;
  }

  get height(): number {
    return this.heightValue;
  }

  ownerLabel(): string {
    return "svg";
  }

  rootCount(): number {
    return this.roots.length;
  }

  resize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new ModelError("size must be positive");
    }
    this.widthValue = width;
    this.heightValue = height;
  }

  insert(parent: Document | Group, shape: Shape, index: number): void {
    if (shape.parent !== null) {
      throw new Error("shape already has a parent");
    }
    this.assertNoCycle(parent, shape);
    this.assertIdsAvailable(parent, shape);
    parent.insertChild(shape, index);
    shape.assignParent(parent);
    this.reindex();
  }

  detach(shape: Shape): void {
    const parent = shape.parent;
    if (parent === null) {
      throw new Error("shape is not in the document");
    }
    parent.removeChild(shape);
    shape.clearParent();
    this.reindex();
  }

  // index 是摘下之后的同级位置：0 为最底，原个数减 1 为最顶。
  moveWithinParent(shape: Shape, index: number): void {
    const parent = shape.parent;
    if (parent === null || !this.contains(shape)) {
      throw new Error("shape is not in the document");
    }
    const count = parent instanceof Group ? parent.childCount() : this.roots.length;
    if (index < 0 || index >= count) {
      throw new Error("index out of range");
    }
    parent.removeChild(shape);
    parent.insertChild(shape, index);
    this.reindex();
  }

  // 文档先序：先节点，再按其子节点当前顺序。
  orderByDocument(shapes: readonly Shape[]): Shape[] {
    const rank = new Map<Shape, number>();
    let next = 0;
    const visit = (shape: Shape): void => {
      rank.set(shape, next);
      next += 1;
      shape.forEachChild(visit);
    };
    for (const root of this.roots) {
      visit(root);
    }
    return shapes.slice().sort((left, right) => {
      const leftRank = rank.get(left);
      const rightRank = rank.get(right);
      if (leftRank === undefined || rightRank === undefined) {
        throw new Error("shape is not in the document");
      }
      return leftRank - rightRank;
    });
  }

  indexInParent(shape: Shape): number {
    const children = this.siblings(shape);
    const index = children.indexOf(shape);
    if (index < 0) {
      throw new Error("shape is not a child of this parent");
    }
    return index;
  }

  siblingCount(shape: Shape): number {
    return this.siblings(shape).length;
  }

  insertChild(shape: Shape, index: number): void {
    if (index < 0 || index > this.roots.length) {
      throw new Error("index out of range");
    }
    this.roots.splice(index, 0, shape);
  }

  removeChild(shape: Shape): void {
    const index = this.roots.indexOf(shape);
    if (index < 0) {
      throw new Error("shape is not a child of this parent");
    }
    this.roots.splice(index, 1);
  }

  replaceChildren(shapes: readonly Shape[]): void {
    this.roots.length = 0;
    this.roots.push(...shapes);
  }

  captureStructure(): StructureSnapshot {
    const groups: Group[] = [];
    for (const root of this.roots) {
      root.collectGroups(groups);
    }
    const groupChildren = new Map<Group, readonly Shape[]>();
    for (const group of groups) {
      groupChildren.set(group, group.copyChildren());
    }
    return { roots: this.roots.slice(), groups: groupChildren };
  }

  restoreStructure(snapshot: StructureSnapshot): void {
    const previousGroups: Group[] = [];
    for (const root of this.roots) {
      root.collectGroups(previousGroups);
    }
    const previouslyIndexed = [...this.index.values()];
    this.replaceChildren(snapshot.roots);
    for (const [group, children] of snapshot.groups) {
      group.replaceChildren(children);
    }
    for (const group of previousGroups) {
      if (!snapshot.groups.has(group)) {
        group.replaceChildren([]);
      }
    }
    for (const shape of previouslyIndexed) {
      shape.clearParent();
    }
    for (const root of this.roots) {
      root.assignParent(this);
    }
    this.reindex();
  }

  allocateId(tag: string): string {
    let number = 1;
    let candidate = `${tag}${number}`;
    while (this.index.has(candidate)) {
      number += 1;
      candidate = `${tag}${number}`;
    }
    return candidate;
  }

  elementCount(): number {
    let count = 0;
    const visit = (shape: Shape): void => {
      count += 1;
      shape.forEachChild(visit);
    };
    for (const root of this.roots) {
      visit(root);
    }
    return count;
  }

  find(id: string): Shape | undefined {
    return this.index.get(id);
  }

  require(id: string): Shape {
    const shape = this.index.get(id);
    if (shape === undefined) {
      throw new ModelError(`no such shape: ${id}`);
    }
    return shape;
  }

  renderTree(id?: string): string {
    if (id === undefined) {
      const label = `svg (${NumberText.format(this.widthValue)}x${NumberText.format(this.heightValue)})`;
      const children = this.roots.map(shape => shape.toTreeNode());
      return TreeText.render(new TreeNode(label, "", children));
    }
    return TreeText.render(this.require(id).toTreeNode());
  }

  renderShow(id: string): string {
    return this.require(id).renderShow();
  }

  toSvg(): string {
    const width = NumberText.format(this.widthValue);
    const height = NumberText.format(this.heightValue);
    const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    const body = this.roots.map(shape => shape.writeSvg("  ")).join("\n");
    const svg = body === "" ? `${open}\n</svg>` : `${open}\n${body}\n</svg>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`;
  }

  private siblings(shape: Shape): readonly Shape[] {
    const parent = shape.parent;
    if (parent instanceof Group) {
      return parent.copyChildren();
    }
    if (parent === this) {
      return this.roots;
    }
    throw new Error("shape is not in the document");
  }

  private assertNoCycle(parent: Document | Group, shape: Shape): void {
    const seen = new Set<Group>();
    let cursor: Document | Group | null = parent;
    while (cursor instanceof Group) {
      if (cursor === shape) {
        throw new ModelError(`cannot add a container into its own descendant: ${shape.id}`);
      }
      if (seen.has(cursor)) {
        throw new Error("document structure is cyclic");
      }
      seen.add(cursor);
      cursor = cursor.parent;
    }
  }

  private assertIdsAvailable(parent: Document | Group, shape: Shape): void {
    const taken = new Set<string>(this.index.keys());
    if (parent instanceof Group) {
      let top: Group = parent;
      while (top.parent instanceof Group) {
        top = top.parent;
      }
      const visitOwner = (node: Shape): void => {
        taken.add(node.id);
        node.forEachChild(visitOwner);
      };
      visitOwner(top);
    }
    const seen = new Set<string>();
    const visit = (node: Shape): void => {
      if (seen.has(node.id) || taken.has(node.id)) {
        throw new ModelError(`id already exists: ${node.id}`);
      }
      seen.add(node.id);
      node.forEachChild(visit);
    };
    visit(shape);
  }

  private contains(shape: Shape): boolean {
    let owner: Document | Group | null = shape.parent;
    while (owner instanceof Group) {
      owner = owner.parent;
    }
    return owner === this;
  }

  private reindex(): void {
    const next = new Map<string, Shape>();
    const visit = (shape: Shape): void => {
      const existing = next.get(shape.id);
      if (existing === shape) {
        throw new Error(`shape appears more than once: ${shape.id}`);
      }
      if (existing !== undefined) {
        throw new ModelError(`id already exists: ${shape.id}`);
      }
      next.set(shape.id, shape);
      shape.forEachChild(visit);
    };
    for (const root of this.roots) {
      visit(root);
    }
    this.index = next;
  }
}
