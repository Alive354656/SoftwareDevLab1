import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Circle } from "../src/model/Circle";
import { Document, type StructureSnapshot } from "../src/model/Document";
import { ElementData } from "../src/model/ElementData";
import { Ellipse } from "../src/model/Ellipse";
import { Group } from "../src/model/Group";
import { Line } from "../src/model/Line";
import { ModelError } from "../src/model/ModelError";
import { NumberText } from "../src/model/NumberText";
import { Rect } from "../src/model/Rect";
import { Shape } from "../src/model/Shape";
import { ShapeFactory } from "../src/model/ShapeFactory";
import { Text } from "../src/model/Text";
import { TreeNode } from "../src/model/TreeNode";
import { TreeText } from "../src/model/TreeText";

const FIRST_TREE = `svg (800x600)
├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff
├── text#title     (20,40) "My Diagram"
└── g#markers
    ├── circle#c1  cx=100 cy=100 r=20 fill=red
    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff`;

const OTHER_TREE = `svg (400x300)
├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff
├── text#t1        (10,290) "imported"
├── circle#c1      cx=50 cy=50 r=10
├── g#g1
│   ├── rect#r2    x=0 y=0 w=10 h=10
│   └── circle#c2  cx=5 cy=5 r=2
└── ellipse#e1     cx=1 cy=2 rx=3 ry=4`;

const FLOW_TREE = `svg (800x600)
└── g#flowchart
    ├── g#node1
    │   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9
    │   └── text#start-label    (155,135) "开始"
    ├── g#node2
    │   ├── rect#process        x=520 y=100 w=160 h=60 fill=#f5a623
    │   └── text#process-label  (545,135) "处理数据"
    └── line#arrow1             (280,130) -> (520,130) stroke=black`;

const FLOW_MOVED = `svg (800x600)
└── g#flowchart
    ├── g#node1
    │   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9
    │   └── text#start-label    (155,135) "开始"
    ├── g#node2
    │   ├── rect#process        x=520 y=200 w=160 h=60 fill=#f5a623
    │   └── text#process-label  (545,235) "处理数据"
    └── line#arrow1             (280,130) -> (520,130) stroke=black`;

const FLOW_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <g id="flow">
    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>
    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>
    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>
  </g>
</svg>
`;

function assertModelError(run: () => void, message: string): void {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof ModelError);
    assert.equal(error.message, message);
    return;
  }
  assert.fail(`expected ModelError: ${message}`);
}

function builder(width: number, height: number): {
  doc: Document;
  factory: ShapeFactory;
  append: {
    (parent: Document | Group, type: "g", id: string, params: readonly string[]): Group;
    (parent: Document | Group, type: string, id: string, params: readonly string[]): Shape;
  };
} {
  const doc = new Document(width, height);
  const factory = new ShapeFactory();
  function append(parent: Document | Group, type: "g", id: string, params: readonly string[]): Group;
  function append(parent: Document | Group, type: string, id: string, params: readonly string[]): Shape;
  function append(parent: Document | Group, type: string, id: string, params: readonly string[]): Shape {
    const shape = factory.create(type, id, params);
    const index = parent instanceof Group ? parent.childCount() : parent.rootCount();
    doc.insert(parent, shape, index);
    return shape;
  }
  return { doc, factory, append };
}

describe("NumberText", () => {
  it("parses finite tokens and prints without binary residue", () => {
    assert.equal(NumberText.parse("10.0"), 10);
    assert.equal(NumberText.parse("0.5"), 0.5);
    assert.equal(NumberText.parse(" 1"), 1);
    assert.equal(NumberText.parse("-0"), 0);
    assert.equal(NumberText.format(100), "100");
    assert.equal(NumberText.format(0.5), "0.5");
    assert.equal(NumberText.format(0.1 + 0.2), "0.3");
    assert.equal(NumberText.format(-0), "0");
    assert.equal(NumberText.format(0.0000001), "0.0000001");
    assertModelError(() => NumberText.parse(""), "invalid number: ");
    assertModelError(() => NumberText.parse("Infinity"), "invalid number: Infinity");
    assertModelError(() => NumberText.parse("nope"), "invalid number: nope");
  });
});

describe("TreeText", () => {
  it("aligns a handwritten tree and ignores rows whose detail is empty", () => {
    assert.equal("├── ".length, 4);
    assert.equal("│   ".length, 4);
    const tree = new TreeNode("root", "", [
      new TreeNode("short", "d", []),
      new TreeNode("much-longer-label", "", [new TreeNode("x", "d", [])]),
    ]);
    const rendered = TreeText.render(tree);
    assert.equal(
      rendered,
      ["root", "├── short  d", "└── much-longer-label", "    └── x  d"].join("\n"),
    );
    const lines = rendered.split("\n");
    assert.equal(lines[1]?.indexOf("d"), 11);
    assert.equal(lines[3]?.indexOf("d"), 11);
  });
});

describe("geometry", () => {
  it("moves a group by baking descendant coordinates and leaves siblings alone", () => {
    const { doc, append } = builder(800, 600);
    const flow = append(doc, "g", "flowchart", []);
    const node1 = append(flow, "g", "node1", []);
    append(node1, "rect", "start", ["120", "100", "160", "60", "#4a90d9"]);
    append(node1, "text", "start-label", ["155", "135", "开始"]);
    const node2 = append(flow, "g", "node2", []);
    const process = append(node2, "rect", "process", ["520", "100", "160", "60", "#f5a623"]);
    const label = append(node2, "text", "process-label", ["545", "135", "处理数据"]);
    const arrow = append(flow, "line", "arrow1", ["280", "130", "520", "130", "black"]);
    assert.equal(doc.elementCount(), 8);
    assert.equal(doc.renderTree(), FLOW_TREE);
    assert.equal(doc.renderTree().split("\n").find(line => line.includes("arrow1"))?.indexOf("(280,130)"), 32);

    const beforeProcess = process.captureFields();
    const beforeLabel = label.captureFields();
    node2.move(0, 100);
    assert.ok(process instanceof Rect);
    assert.ok(label instanceof Text);
    assert.ok(arrow instanceof Line);
    assert.equal(process.y, 200);
    assert.equal(label.y, 235);
    assert.equal(label.content, "处理数据");
    assert.equal(arrow.y1, 130);
    assert.equal(arrow.y2, 130);
    assert.equal(doc.renderTree(), FLOW_MOVED);
    assert.equal(doc.toSvg().includes("transform"), false);

    process.restoreFields(beforeProcess);
    label.restoreFields(beforeLabel);
    assert.equal(doc.renderTree(), FLOW_TREE);
  });

  it("scales text position only and keeps the content", () => {
    const content = 'say "hi"';
    const { doc, append } = builder(100, 100);
    const group = append(doc, "g", "g", []);
    const text = append(group, "text", "t", ["10", "20", content]);
    const beforeTree = doc.renderTree();
    assert.throws(() => text.scale(0), (error: unknown) => {
      return error instanceof ModelError && error.message === "scale factor must be positive";
    });
    assert.throws(() => group.scale(-2), (error: unknown) => {
      return error instanceof ModelError && error.message === "scale factor must be positive";
    });
    assert.equal(doc.renderTree(), beforeTree);

    const fieldsBeforeScale = group.captureFields();
    group.scale(2);
    assert.ok(text instanceof Text);
    assert.equal(text.x, 20);
    assert.equal(text.y, 40);
    assert.equal(text.content, content);
    group.restoreFields(fieldsBeforeScale);
    assert.equal(text.x, 20);
    text.scale(2);
    assert.equal(text.content, content);
    assert.equal(text.x, 40);
    assert.equal(text.y, 80);
    assert.equal(doc.toSvg().includes("font-size"), false);
    assert.equal(
      doc.renderTree(),
      ['svg (100x100)', "└── g#g", '    └── text#t  (40,80) "say \\"hi\\""'].join("\n"),
    );
    assertModelError(() => text.setAttribute("font-size", "16"), "unknown attribute: font-size");
  });

  it("moves and scales each leaf, including zeroes and negatives", () => {
    const { doc, append } = builder(10, 10);
    const rect = append(doc, "rect", "r", ["-1", "0", "2", "3"]);
    const circle = append(doc, "circle", "c", ["1", "1", "1"]);
    const ellipse = append(doc, "ellipse", "e", ["1", "2", "3", "4"]);
    const line = append(doc, "line", "l", ["1", "2", "3", "4"]);
    assert.ok(rect instanceof Rect);
    assert.ok(circle instanceof Circle);
    assert.ok(ellipse instanceof Ellipse);
    assert.ok(line instanceof Line);
    rect.move(-1, 5);
    circle.scale(2);
    ellipse.move(0, -2);
    line.scale(0.5);
    assert.equal(rect.x, -2);
    assert.equal(rect.y, 5);
    assert.equal(rect.width, 2);
    assert.equal(circle.cx, 2);
    assert.equal(circle.r, 2);
    assert.equal(ellipse.cy, 0);
    assert.equal(line.x1, 0.5);
    assert.equal(line.y1, 1);
    assert.equal(line.x2, 1.5);
    assert.equal(line.y2, 2);
  });
});

describe("identifiers", () => {
  it("rejects a duplicate id and leaves the document unchanged", () => {
    const { doc, factory, append } = builder(800, 600);
    append(doc, "rect", "bg", ["0", "0", "1", "1"]);
    append(doc, "rect", "Bg", ["0", "0", "1", "1"]);
    const svg = doc.toSvg();
    const duplicate = factory.create("rect", "bg", ["1", "1", "1", "1"]);
    assertModelError(() => doc.insert(doc, duplicate, 2), "id already exists: bg");
    assert.equal(duplicate.parent, null);
    assert.equal(doc.toSvg(), svg);
    assert.equal(doc.elementCount(), 2);
    assert.equal(doc.allocateId("rect"), "rect1");
    append(doc, "rect", "rect1", ["0", "0", "1", "1"]);
    append(doc, "rect", "rect3", ["0", "0", "1", "1"]);
    assert.equal(doc.allocateId("rect"), "rect2");
  });

  it("frees ids of a detached subtree and still points children at that group", () => {
    const { doc, factory, append } = builder(800, 600);
    const markers = append(doc, "g", "markers", []);
    const circle = append(markers, "circle", "c1", ["0", "0", "1"]);
    assert.ok(markers instanceof Group);
    doc.detach(markers);
    assert.equal(markers.parent, null);
    assert.equal(circle.parent, markers);
    assert.equal(markers.childCount(), 1);
    assertModelError(() => doc.require("c1"), "no such shape: c1");
    assert.equal(doc.allocateId("c"), "c1");
    const replacement = factory.create("circle", "c1", ["1", "1", "1"]);
    doc.insert(doc, replacement, 0);
    assert.equal(doc.require("c1"), replacement);
  });

  it("rejects an id that already exists in the same offline tree", () => {
    const { doc, factory } = builder(10, 10);
    const group = factory.create("g", "g", []);
    const first = factory.create("rect", "a", ["0", "0", "1", "1"]);
    const second = factory.create("rect", "a", ["1", "0", "1", "1"]);
    assert.ok(group instanceof Group);
    doc.insert(group, first, 0);
    assertModelError(() => doc.insert(group, second, 1), "id already exists: a");
    assert.equal(group.childCount(), 1);
    assert.equal(doc.elementCount(), 0);
  });
});

describe("structure", () => {
  it("renders the section 9 sample after grouping in document order", () => {
    const { doc, factory, append } = builder(800, 600);
    append(doc, "rect", "bg", ["0", "0", "800", "600", "#ffffff"]);
    append(doc, "text", "title", ["20", "40", "My Diagram"]);
    const c1 = append(doc, "circle", "c1", ["100", "100", "20", "red"]);
    const box = append(doc, "rect", "box", ["200", "80", "60", "60", "#3366ff"]);
    const markers = factory.create("g", "markers", []);
    assert.ok(markers instanceof Group);
    doc.detach(c1);
    doc.detach(box);
    doc.insert(doc, markers, 2);
    doc.insert(markers, c1, 0);
    doc.insert(markers, box, 1);
    assert.equal(doc.elementCount(), 5);
    assert.equal(doc.renderTree(), FIRST_TREE);
    assert.equal(doc.renderShow("c1"), ["circle#c1  parent=g#markers", "  cx=100 cy=100 r=20", "  fill=red"].join("\n"));
    for (const line of doc.renderTree().split("\n")) {
      const detail = line.search(/x=|\(20,40\)|cx=/);
      if (detail >= 0) {
        assert.equal(detail, 19);
      }
    }
  });

  it("renders the other.svg tree, including a continued branch", () => {
    const { doc, append } = builder(400, 300);
    append(doc, "rect", "rect1", ["0", "0", "400", "300", "#ffffff"]);
    append(doc, "text", "t1", ["10", "290", "imported"]);
    append(doc, "circle", "c1", ["50", "50", "10"]);
    const g1 = append(doc, "g", "g1", []);
    append(g1, "rect", "r2", ["0", "0", "10", "10"]);
    append(g1, "circle", "c2", ["5", "5", "2"]);
    append(doc, "ellipse", "e1", ["1", "2", "3", "4"]);
    assert.equal(doc.renderTree(), OTHER_TREE);
    assert.equal(doc.elementCount(), 7);
  });

  it("restores structure snapshots by relinking the same shape objects", () => {
    const { doc, factory, append } = builder(10, 10);
    const r1 = append(doc, "rect", "r1", ["0", "0", "1", "1"]);
    const r2 = append(doc, "rect", "r2", ["2", "0", "1", "1"]);
    const before = doc.captureStructure();
    const group = factory.create("g", "g", []);
    assert.ok(group instanceof Group);
    doc.detach(r1);
    doc.detach(r2);
    doc.insert(doc, group, 0);
    doc.insert(group, r1, 0);
    doc.insert(group, r2, 1);
    const after = doc.captureStructure();
    doc.restoreStructure(before);
    assert.equal(doc.require("r1"), r1);
    assert.equal(r1.parent, doc);
    assert.equal(group.parent, null);
    assert.equal(group.childCount(), 0);
    assertModelError(() => doc.require("g"), "no such shape: g");
    doc.restoreStructure(after);
    assert.equal(r1.parent, group);
    assert.equal(r2.parent, group);
    assert.equal(group.parent, doc);
    assert.equal(doc.rootCount(), 1);
  });

  it("can place a new group at the earlier member even when members start in different parents", () => {
    const { doc, factory, append } = builder(10, 10);
    const a = append(doc, "g", "A", []);
    const r1 = append(a, "rect", "r1", ["0", "0", "1", "1"]);
    const b = append(doc, "g", "B", []);
    const r2 = append(b, "rect", "r2", ["2", "0", "1", "1"]);
    const group = factory.create("g", "g", []);
    assert.ok(a instanceof Group);
    assert.ok(b instanceof Group);
    assert.ok(group instanceof Group);
    doc.detach(r1);
    doc.detach(r2);
    doc.insert(a, group, 0);
    doc.insert(group, r1, 0);
    doc.insert(group, r2, 1);
    assert.equal(group.parent, a);
    assert.equal(r1.parent, group);
    assert.equal(r2.parent, group);
    assert.equal(b.childCount(), 0);
    assert.equal(doc.renderTree().includes("g#A"), true);
    assert.match(doc.toSvg(), /<g id="A">\s*<g id="g">\s*<rect id="r1"[^>]*\/>\s*<rect id="r2"[^>]*\/>\s*<\/g>\s*<\/g>\s*<g id="B"\/>/);
  });

  it("refuses to insert a container into its own descendant", () => {
    const { doc, append } = builder(10, 10);
    const outer = append(doc, "g", "outer", []);
    const inner = append(outer, "g", "inner", []);
    assert.ok(outer instanceof Group);
    assert.ok(inner instanceof Group);
    doc.detach(outer);
    assert.equal(inner.parent, outer);
    assertModelError(
      () => doc.insert(inner, outer, 0),
      "cannot add a container into its own descendant: outer",
    );
    assertModelError(
      () => doc.insert(outer, outer, 0),
      "cannot add a container into its own descendant: outer",
    );
    assert.equal(outer.parent, null);
    assert.equal(inner.parent, outer);
    assert.equal(outer.childCount(), 1);
    assert.equal(doc.elementCount(), 0);
  });

  it("moves a shape to the end of its parent and can restore that order", () => {
    const { doc, append } = builder(10, 10);
    const r1 = append(doc, "rect", "r1", ["0", "0", "1", "1"]);
    append(doc, "rect", "r2", ["1", "0", "1", "1"]);
    const before: StructureSnapshot = doc.captureStructure();
    doc.moveWithinParent(r1, 1);
    assert.match(doc.toSvg(), /id="r2"[\s\S]*id="r1"/);
    doc.restoreStructure(before);
    assert.match(doc.toSvg(), /id="r1"[\s\S]*id="r2"/);
  });
});

describe("svg", () => {
  it("writes the 0.1 fixture, omits unset paint, and escapes text", () => {
    const { doc, append } = builder(400, 200);
    const flow = append(doc, "g", "flow", []);
    append(flow, "rect", "start", ["30", "70", "120", "60", "#4a90d9"]);
    const edge = append(flow, "line", "edge", ["150", "100", "250", "100", "black"]);
    append(flow, "rect", "end", ["250", "70", "120", "60", "#f5a623"]);
    assert.equal(doc.toSvg(), FLOW_SVG);
    assert.equal(
      doc.renderShow("edge"),
      ["line#edge  parent=g#flow", "  x1=150 y1=100 x2=250 y2=100", "  stroke=black"].join("\n"),
    );
    assert.equal(doc.renderShow("flow"), ["g#flow  parent=svg", "  children=3"].join("\n"));
    assert.ok(edge instanceof Line);
    assert.equal(edge.fill, undefined);

    const plain = new Document(800, 600);
    const factory = new ShapeFactory();
    const rect = factory.create("rect", "r", ["10.0", "0", "1", "1"]);
    plain.insert(plain, rect, 0);
    assert.match(plain.toSvg(), /x="10"/);
    assert.equal(plain.toSvg().includes("10.0"), false);
    assert.equal(plain.toSvg().includes("fill="), false);
    assert.equal(
      new Document(800, 600).toSvg(),
      `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
</svg>
`,
    );

    const scene = new Document(800, 600);
    scene.insert(scene, factory.create("g", "scene", []), 0);
    assert.match(scene.toSvg(), /<g id="scene"\/>/);

    const quoted = factory.create("rect", 'a"b', ["0", "0", "1", "1"]);
    quoted.setAttribute("fill", 'a"b');
    const text = factory.create("text", "t", ["0", "1", "&<>"]);
    const escaped = new Document(10, 10);
    escaped.insert(escaped, quoted, 0);
    escaped.insert(escaped, text, 1);
    const svg = escaped.toSvg();
    assert.match(svg, /id="a&quot;b"/);
    assert.match(svg, /fill="a&quot;b"/);
    assert.match(svg, /<text id="t" x="0" y="1">&amp;&lt;&gt;<\/text>/);
  });

  it("rejects a non-positive canvas and resizes with formatted numbers", () => {
    assertModelError(() => new Document(0, 1), "size must be positive");
    assertModelError(() => new Document(-5, 5), "size must be positive");
    assertModelError(() => new Document(Number.POSITIVE_INFINITY, 1), "size must be positive");
    const doc = new Document(0.5, 1);
    doc.resize(2, 3);
    assert.equal(doc.renderTree(), "svg (2x3)");
  });
});

describe("factory and attributes", () => {
  const factory = new ShapeFactory();

  it("creates the six kinds and reports usage before parsing numbers", () => {
    assertModelError(
      () => factory.create("hexagon", "h", []),
      "unknown shape type: hexagon (is the plugin loaded?)",
    );
    assertModelError(
      () => factory.create("rect", "r", ["1"]),
      "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]",
    );
    assertModelError(
      () => factory.create("text", "t", ["0", "0", "hello", "red"]),
      'usage: create text <id> <x> <y> "content" [in <containerId>]',
    );
    assertModelError(() => factory.create("g", "g", ["red"]), "usage: create g <id> [in <containerId>]");
    assertModelError(() => factory.create("rect", "r", ["nope", "0", "1", "1"]), "invalid number: nope");

    const line = factory.create("line", "e", ["0", "0", "1", "1", "black"]);
    assert.ok(line instanceof Line);
    assert.equal(line.stroke, "black");
    assert.equal(line.fill, undefined);
    const rect = factory.create("rect", "r", ["0", "0", "1", "1"]);
    assert.ok(rect instanceof Rect);
    assert.equal(rect.fill, undefined);
  });

  it("keeps the previous value when set fails, and restore can remove paint", () => {
    const rect = factory.create("rect", "r", ["0", "0", "1", "1"]);
    assert.ok(rect instanceof Rect);
    const before = rect.captureFields();
    rect.setAttribute("x", "3");
    rect.setAttribute("fill", "red");
    rect.setAttribute("stroke-width", "2");
    assertModelError(() => rect.setAttribute("x", "nope"), "invalid number: nope");
    assertModelError(() => rect.setAttribute("Fill", "blue"), "unknown attribute: Fill");
    assert.equal(rect.x, 3);
    assert.equal(rect.fill, "red");
    assert.equal(rect.strokeWidth, 2);
    rect.restoreFields(before);
    assert.equal(rect.x, 0);
    assert.equal(rect.fill, undefined);
    assert.equal(rect.strokeWidth, undefined);
    assert.equal(rect.writeSvg("").includes("fill="), false);
    rect.setAttribute("fill", "");
    assert.match(rect.writeSvg(""), /fill=""/);

    const group = factory.create("g", "g", []);
    assertModelError(() => group.setAttribute("x", "1"), "unknown attribute: x");
    group.setAttribute("fill", "none");
    const doc = new Document(10, 10);
    doc.insert(doc, group, 0);
    assert.match(doc.renderTree(), /g#g\s+fill=none/);
  });

  it("builds a shape from element data and leaves unknown attributes unconsumed", () => {
    const created = factory.createFromElement(
      new ElementData(
        "rect",
        [
          { name: "id", value: "ignored" },
          { name: "x", value: "1" },
          { name: "y", value: "2" },
          { name: "width", value: "3" },
          { name: "height", value: "4" },
          { name: "transform", value: "scale(2)" },
          { name: "style", value: "fill:red" },
          { name: "fill", value: "red" },
        ],
        "",
        [],
      ),
      "r",
    );
    assert.equal(created.consumed.has("id"), false);
    assert.equal(created.consumed.has("transform"), false);
    assert.equal(created.consumed.has("style"), false);
    assert.equal(created.consumed.has("x"), true);
    assert.ok(created.shape instanceof Rect);
    assert.equal(created.shape.id, "r");
    assert.equal(created.shape.x, 1);
    assert.equal(created.shape.fill, "red");

    const group = factory.createFromElement(
      new ElementData("g", [{ name: "id", value: "g1" }], "", [new ElementData("rect", [], "", [])]),
      "g1",
    );
    assert.ok(group.shape instanceof Group);
    assert.equal(group.shape.childCount(), 0);

    assertModelError(
      () => factory.createFromElement(new ElementData("title", [], "", []), "t"),
      "unsupported element: title",
    );
    assertModelError(
      () =>
        factory.createFromElement(
          new ElementData("text", [{ name: "x", value: "0" }, { name: "y", value: "0" }], "hi", [
            new ElementData("tspan", [], "x", []),
          ]),
          "t",
        ),
      "unsupported element: tspan",
    );
    assertModelError(
      () =>
        factory.createFromElement(
          new ElementData("rect", [{ name: "y", value: "1" }, { name: "width", value: "1" }, { name: "height", value: "1" }], "", []),
          "r",
        ),
      "invalid svg: missing attribute: x",
    );
  });

  it("reports a missing shape from tree and show", () => {
    const doc = new Document(10, 10);
    assertModelError(() => doc.renderTree("missing"), "no such shape: missing");
    assertModelError(() => doc.renderShow("missing"), "no such shape: missing");
  });
});
