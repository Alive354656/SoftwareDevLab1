import { DOMParser, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { Document } from "../model/Document";
import { ElementData, type AttributeData } from "../model/ElementData";
import { Group } from "../model/Group";
import { ModelError } from "../model/ModelError";
import { NumberText } from "../model/NumberText";
import { ShapeFactory } from "../model/ShapeFactory";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

export interface SvgReadResult {
  readonly document: Document;
  readonly warnings: readonly string[];
}

export class SvgReader {
  private static readonly lengthNames: ReadonlySet<string> = new Set([
    "x",
    "y",
    "width",
    "height",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x1",
    "y1",
    "x2",
    "y2",
    "stroke-width",
  ]);

  private static readonly rootNames: ReadonlySet<string> = new Set(["width", "height", "viewBox"]);

  private readonly factory = new ShapeFactory();

  read(xml: string): SvgReadResult {
    const data = this.elementData(this.parse(xml));
    if (data.tag !== "svg") {
      throw new ModelError("invalid svg: root element is not svg");
    }
    const size = this.canvasSize(data);
    const warnings: string[] = [];
    this.warnUnused(data, SvgReader.rootNames, "svg", false, warnings);
    const document = new Document(size.width, size.height);
    for (const child of data.children) {
      this.loadShape(document, document, child, warnings);
    }
    return { document, warnings };
  }

  private parse(xml: string): XmlElement {
    const problems: string[] = [];
    const parser = new DOMParser({
      onError(level: "warning" | "error" | "fatalError", message: string): void {
        if (level !== "warning") {
          problems.push(message);
        }
      },
    });
    let parsed: XmlDocument;
    try {
      parsed = parser.parseFromString(this.withoutBom(xml), "image/svg+xml");
    } catch (error) {
      throw new ModelError(`invalid svg: ${problems[0] ?? this.fallbackReason(error)}`);
    }
    const problem = problems[0];
    if (problem !== undefined) {
      throw new ModelError(`invalid svg: ${problem}`);
    }
    const root = parsed.documentElement;
    if (root === null) {
      throw new ModelError("invalid svg: root element is not svg");
    }
    return root;
  }

  private withoutBom(xml: string): string {
    return xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  }

  private fallbackReason(error: unknown): string {
    if (error instanceof Error && error.message !== "") {
      return error.message;
    }
    return "malformed xml";
  }

  private elementData(element: XmlElement): ElementData {
    const attributes: AttributeData[] = [];
    for (let index = 0; index < element.attributes.length; index += 1) {
      const attribute = element.attributes.item(index);
      if (attribute !== null) {
        attributes.push({ name: attribute.name, value: attribute.value });
      }
    }
    const children: ElementData[] = [];
    const texts: string[] = [];
    for (let index = 0; index < element.childNodes.length; index += 1) {
      const child = element.childNodes.item(index);
      if (child === null) {
        continue;
      }
      if (this.isElement(child)) {
        children.push(this.elementData(child));
        continue;
      }
      if (child.nodeType === TEXT_NODE || child.nodeType === CDATA_SECTION_NODE) {
        texts.push(child.nodeValue ?? "");
      }
    }
    const text =
      children.length === 0 ? texts.join("") : texts.filter(part => part.trim() !== "").join("");
    return new ElementData(element.localName ?? element.tagName, attributes, text, children);
  }

  private isElement(node: XmlNode): node is XmlElement {
    return node.nodeType === ELEMENT_NODE;
  }

  private canvasSize(element: ElementData): { width: number; height: number } {
    const widthText = element.attribute("width");
    const heightText = element.attribute("height");
    let width = widthText === undefined ? undefined : this.lengthNumber(widthText);
    let height = heightText === undefined ? undefined : this.lengthNumber(heightText);
    if (width === undefined || height === undefined) {
      const viewBox = element.attribute("viewBox");
      const box = viewBox === undefined ? null : this.viewBoxParts(viewBox);
      if (box !== null) {
        if (width === undefined) {
          width = this.lengthNumber(box.width);
        }
        if (height === undefined) {
          height = this.lengthNumber(box.height);
        }
      }
    }
    if (width === undefined || height === undefined) {
      throw new ModelError("invalid svg: missing canvas size");
    }
    return { width, height };
  }

  private viewBoxParts(value: string): { width: string; height: string } | null {
    const parts = value
      .trim()
      .split(/[\s,]+/)
      .filter(part => part !== "");
    const width = parts[2];
    const height = parts[3];
    if (width === undefined || height === undefined) {
      return null;
    }
    return { width, height };
  }

  private loadShape(
    document: Document,
    parent: Document | Group,
    element: ElementData,
    warnings: string[],
  ): void {
    const consumed = this.factory.consumedAttributes(element.tag);
    const normalized = this.normalize(element, consumed);
    const rawId = element.attribute("id");
    let id: string;
    let assigned = false;
    if (rawId === undefined || rawId.trim() === "") {
      id = document.allocateId(element.tag);
      assigned = true;
    } else {
      id = rawId;
    }
    const created = this.factory.createFromElement(normalized, id);
    if (assigned) {
      warnings.push(`warning: assigned id ${id} to unnamed <${element.tag}>`);
    }
    this.warnUnused(element, consumed, created.shape.label(), true, warnings);
    const index = parent instanceof Group ? parent.childCount() : document.rootCount();
    document.insert(parent, created.shape, index);
    const container = created.shape.asContainer();
    if (container === null) {
      return;
    }
    for (const child of element.children) {
      this.loadShape(document, container, child, warnings);
    }
  }

  // px 留在读取器里去掉，模型只看到纯数字。不认识的属性不进这里。
  private normalize(element: ElementData, consumed: ReadonlySet<string>): ElementData {
    const attributes = element.attributes.map(attribute => {
      if (!consumed.has(attribute.name) || !SvgReader.lengthNames.has(attribute.name)) {
        return attribute;
      }
      return { name: attribute.name, value: this.lengthToken(attribute.value) };
    });
    return new ElementData(element.tag, attributes, element.text, element.children);
  }

  private lengthNumber(raw: string): number {
    return NumberText.parse(this.lengthToken(raw));
  }

  private lengthToken(raw: string): string {
    const trimmed = raw.trim();
    const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(trimmed);
    if (match === null) {
      throw new ModelError(`invalid number: ${raw}`);
    }
    const body = match[0];
    const unit = trimmed.slice(body.length);
    if (unit !== "" && unit !== "px") {
      throw new ModelError(`invalid svg: unsupported length: ${raw}`);
    }
    const value = Number(body);
    if (!Number.isFinite(value)) {
      throw new ModelError(`invalid number: ${raw}`);
    }
    return body;
  }

  private warnUnused(
    element: ElementData,
    consumed: ReadonlySet<string>,
    label: string,
    skipId: boolean,
    warnings: string[],
  ): void {
    for (const attribute of element.attributes) {
      if (skipId && attribute.name === "id") {
        continue;
      }
      if (consumed.has(attribute.name) || this.isNamespace(attribute.name)) {
        continue;
      }
      warnings.push(`warning: ignored attribute ${attribute.name} on ${label}`);
    }
  }

  private isNamespace(name: string): boolean {
    return name === "xmlns" || name.startsWith("xmlns:");
  }
}
