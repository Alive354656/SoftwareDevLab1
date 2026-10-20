import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { EditorSession } from "../src/app/EditorSession";

const fixtures = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

const GROUPED_TREE = `svg (800x600)
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

function replay(editor: EditorSession, pairs: readonly (readonly [string, string])[]): void {
  for (const [line, expected] of pairs) {
    assert.deepEqual(editor.executeLine(line), [expected], line);
  }
}

function withDirectory(body: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), "svg-editor-"));
  const previous = process.cwd();
  process.chdir(dir);
  try {
    body(dir);
  } finally {
    process.chdir(previous);
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("spec sessions", () => {
  it("replays section 6 through both trees and the group error", () => {
    withDirectory(dir => {
      copyFileSync(path.join(fixtures, "other.svg"), path.join(dir, "other.svg"));
      const editor = new EditorSession();
      replay(editor, [
        ["init 800 600", "canvas 800x600 created"],
        ["create rect bg 0 0 800 600 #ffffff", "rect#bg created"],
        ['create text title 20 40 "My Diagram"', "text#title created"],
        ["create circle c1 100 100 20 red", "circle#c1 created"],
        ["create rect box 200 80 60 60 #3366ff", "rect#box created"],
        ["group markers c1 box", "g#markers created with 2 children"],
      ]);
      assert.deepEqual(editor.executeLine("tree"), [GROUPED_TREE]);
      replay(editor, [
        ["move c1 30 0", "circle#c1 moved to (130,100)"],
        ["undo", "circle#c1 moved back to (100,100)"],
        ["redo", "circle#c1 moved to (130,100)"],
        ['set title text "My Diagram v2"', 'text#title updated: text="My Diagram v2"'],
        ["undo", 'text#title updated: text="My Diagram"'],
      ]);
      assert.deepEqual(editor.executeLine("group bad c1 markers"), [
        "error: cannot group a container into its own descendant: markers",
      ]);
      replay(editor, [
        ["delete box", "rect#box deleted"],
        ["undo", "rect#box restored into g#markers"],
        ["save demo.svg", "saved to demo.svg (5 elements)"],
      ]);
      assert.deepEqual(editor.executeLine("undo"), ["error: undo not allowed after io command"]);
      assert.deepEqual(editor.executeLine("read other.svg"), [
        "warning: assigned id rect1 to unnamed <rect>",
        "read other.svg (7 elements)",
      ]);
      assert.deepEqual(editor.executeLine("tree"), [OTHER_TREE]);
    });
  });

  it("replays section 6.1 version A and saves eight elements", () => {
    withDirectory(() => {
      const editor = new EditorSession();
      replay(editor, [
        ["init 800 600", "canvas 800x600 created"],
        ["create g flowchart", "g#flowchart created"],
        ["create g node1 in flowchart", "g#node1 created in g#flowchart"],
        ["create rect start 120 100 160 60 #4a90d9 in node1", "rect#start created in g#node1"],
        ['create text start-label 155 135 "开始" in node1', "text#start-label created in g#node1"],
        ["create g node2 in flowchart", "g#node2 created in g#flowchart"],
        ["create rect process 520 100 160 60 #f5a623 in node2", "rect#process created in g#node2"],
        [
          'create text process-label 545 135 "处理数据" in node2',
          "text#process-label created in g#node2",
        ],
        ["create line arrow1 280 130 520 130 black in flowchart", "line#arrow1 created in g#flowchart"],
      ]);
      assert.deepEqual(editor.executeLine("tree"), [FLOW_TREE]);
      assert.deepEqual(editor.executeLine("move node2 0 100"), ["g#node2 moved by (0,100)"]);
      assert.deepEqual(editor.executeLine("tree"), [FLOW_MOVED]);
      assert.deepEqual(editor.executeLine("undo"), ["g#node2 moved back by (0,-100)"]);
      assert.deepEqual(editor.executeLine("tree"), [FLOW_TREE]);
      assert.deepEqual(editor.executeLine('set process-label text "处理数据 v2"'), [
        'text#process-label updated: text="处理数据 v2"',
      ]);
      assert.deepEqual(editor.executeLine("save flowchart.svg"), [
        "saved to flowchart.svg (8 elements)",
      ]);
      assert.equal(editor.document?.elementCount(), 8);
    });
  });
});
