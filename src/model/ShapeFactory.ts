import { Circle } from "./Circle";
import { ElementData } from "./ElementData";
import { Ellipse } from "./Ellipse";
import { Group } from "./Group";
import { Line } from "./Line";
import { ModelError } from "./ModelError";
import { Rect } from "./Rect";
import { Shape } from "./Shape";
import { Text } from "./Text";

interface ShapeKind {
  readonly usage: string;
  readonly consumed: ReadonlySet<string>;
  create(id: string, params: readonly string[]): Shape;
  fromElement(element: ElementData, id: string): Shape;
}

export class ShapeFactory {
  // 待重构：类型名到图形类的映射是另一处按名字分发。
  // box 一类的图形插件应替换这里，而不是在 CreateCommand 里判断类型。
  private static readonly kinds = new Map<string, ShapeKind>([
    ["rect", Rect],
    ["circle", Circle],
    ["ellipse", Ellipse],
    ["line", Line],
    ["text", Text],
    ["g", Group],
  ]);

  supports(type: string): boolean {
    return ShapeFactory.kinds.has(type);
  }

  usage(type: string): string {
    const kind = ShapeFactory.kinds.get(type);
    if (kind === undefined) {
      throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return kind.usage;
  }

  create(type: string, id: string, params: readonly string[]): Shape {
    const kind = ShapeFactory.kinds.get(type);
    if (kind === undefined) {
      throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return kind.create(id, params);
  }

  createFromElement(element: ElementData, id: string): { shape: Shape; consumed: ReadonlySet<string> } {
    const kind = ShapeFactory.kinds.get(element.tag);
    if (kind === undefined) {
      throw new ModelError(`unsupported element: ${element.tag}`);
    }
    return { shape: kind.fromElement(element, id), consumed: kind.consumed };
  }
}
