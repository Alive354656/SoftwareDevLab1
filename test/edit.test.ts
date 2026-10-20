import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorSession } from "../src/app/EditorSession";
import { Command, type CommandResult } from "../src/command/Command";
import { CommandError } from "../src/command/CommandError";
import { CommandHistory } from "../src/command/CommandHistory";
import type { EditorContext } from "../src/command/EditorContext";

const FLAT_TREE = `svg (800x600)
├── rect#bg     x=0 y=0 w=800 h=600 fill=#ffffff
├── text#title  (20,40) "My Diagram"
├── circle#c1   cx=100 cy=100 r=20 fill=red
└── rect#box    x=200 y=80 w=60 h=60 fill=#3366ff`;

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

function session(): EditorSession {
  return new EditorSession();
}

function run(editor: EditorSession, line: string): string[] {
  return editor.executeLine(line);
}

function replay(editor: EditorSession, pairs: readonly (readonly [string, string])[]): void {
  for (const [line, expected] of pairs) {
    assert.deepEqual(run(editor, line), [expected], line);
  }
}

function fingerprint(editor: EditorSession): string {
  const document = editor.document;
  if (document === null) {
    return [
      `path=${editor.filePath}`,
      `undo=${editor.undoDepth}`,
      `redo=${editor.redoDepth}`,
      `locked=${editor.historyLocked}`,
    ].join("\n");
  }
  return [
    `path=${editor.filePath}`,
    `canvas=${document.width}x${document.height}`,
    `undo=${editor.undoDepth}`,
    `redo=${editor.redoDepth}`,
    `locked=${editor.historyLocked}`,
    document.renderTree(),
    document.toSvg(),
  ].join("\n");
}

describe("basic editing", () => {
  it("replays the file-free part of the section 6 session without group", () => {
    const editor = session();
    replay(editor, [
      ["init 800 600", "canvas 800x600 created"],
      ["create rect bg 0 0 800 600 #ffffff", "rect#bg created"],
      ['create text title 20 40 "My Diagram"', "text#title created"],
      ["create circle c1 100 100 20 red", "circle#c1 created"],
      ["create rect box 200 80 60 60 #3366ff", "rect#box created"],
    ]);
    assert.deepEqual(run(editor, "tree"), [FLAT_TREE]);
    assert.deepEqual(run(editor, "show c1"), [
      ["circle#c1  parent=svg", "  cx=100 cy=100 r=20", "  fill=red"].join("\n"),
    ]);
    replay(editor, [
      ["move c1 30 0", "circle#c1 moved to (130,100)"],
      ["undo", "circle#c1 moved back to (100,100)"],
      ["redo", "circle#c1 moved to (130,100)"],
      ['set title text "My Diagram v2"', 'text#title updated: text="My Diagram v2"'],
      ["undo", 'text#title updated: text="My Diagram"'],
      ["delete box", "rect#box deleted"],
      ["undo", "rect#box restored into svg"],
    ]);
    assert.deepEqual(run(editor, "show c1"), [
      ["circle#c1  parent=svg", "  cx=130 cy=100 r=20", "  fill=red"].join("\n"),
    ]);
    replay(editor, [["redo", "rect#box deleted"]]);
    assert.equal(editor.undoDepth, 6);
    assert.equal(editor.redoDepth, 0);
    assert.equal(editor.historyLocked, false);
  });

  it("moves a group by baking child coordinates and leaves the sibling line", () => {
    const editor = session();
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
    assert.deepEqual(run(editor, "tree"), [FLOW_TREE]);
    replay(editor, [["move node2 0 100", "g#node2 moved by (0,100)"]]);
    assert.deepEqual(run(editor, "tree"), [FLOW_MOVED]);
    replay(editor, [["undo", "g#node2 moved back by (0,-100)"]]);
    assert.deepEqual(run(editor, "tree"), [FLOW_TREE]);
    replay(editor, [
      ["redo", "g#node2 moved by (0,100)"],
      ["undo", "g#node2 moved back by (0,-100)"],
      ["delete process", "rect#process deleted"],
      ["undo", "rect#process restored into g#node2"],
    ]);
    assert.deepEqual(run(editor, "tree"), [FLOW_TREE]);
  });

  it("restores field snapshots on redo instead of applying the delta again", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create circle c 100 100 20", "circle#c created"],
      ["move c 30 0", "circle#c moved to (130,100)"],
      ["undo", "circle#c moved back to (100,100)"],
      ["redo", "circle#c moved to (130,100)"],
      ["undo", "circle#c moved back to (100,100)"],
      ["redo", "circle#c moved to (130,100)"],
      ["scale c 2", "circle#c scaled by 2"],
      ["undo", "circle#c scaled back by 0.5"],
      ["redo", "circle#c scaled by 2"],
    ]);
    assert.deepEqual(run(editor, "show c"), [
      ["circle#c  parent=svg", "  cx=260 cy=200 r=40"].join("\n"),
    ]);
    replay(editor, [
      ["scale c 0.1", "circle#c scaled by 0.1"],
      ["scale c 0.1", "circle#c scaled by 0.1"],
      ["undo", "circle#c scaled back by 10"],
      ["undo", "circle#c scaled back by 10"],
    ]);
    assert.deepEqual(run(editor, "show c"), [
      ["circle#c  parent=svg", "  cx=260 cy=200 r=40"].join("\n"),
    ]);
  });

  it("uses each shape's own anchor and keeps text content when scaling", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect r 10 20 1 1", "rect#r created"],
      ["move r -1 0", "rect#r moved to (9,20)"],
      ["create ellipse e 1 2 3 4", "ellipse#e created"],
      ["move e 1 1", "ellipse#e moved to (2,3)"],
      ["create line edge 1 2 3 4 black", "line#edge created"],
      ["move edge 5 -1", "line#edge moved to (6,1)"],
      ['create text t 20 40 "My Diagram"', "text#t created"],
      ["move t 0 -1", "text#t moved to (20,39)"],
      ["scale t 2", "text#t scaled by 2"],
    ]);
    assert.deepEqual(run(editor, "show t"), [
      ['text#t  parent=svg', "  x=40 y=78", '  text="My Diagram"'].join("\n"),
    ]);
    assert.deepEqual(run(editor, "show edge"), [
      ["line#edge  parent=svg", "  x1=6 y1=1 x2=8 y2=3", "  stroke=black"].join("\n"),
    ]);
  });

  it("drops an attribute that was unset and quotes only text", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect r 0 0 1 1", "rect#r created"],
      ["set r fill red", "rect#r updated: fill=red"],
      ["undo", "rect#r updated: fill removed"],
    ]);
    assert.equal(editor.document?.toSvg().includes("fill="), false);
    replay(editor, [
      ["redo", "rect#r updated: fill=red"],
      ["set r x 10.50", "rect#r updated: x=10.5"],
      ["undo", "rect#r updated: x=0"],
      ["set r stroke-width 2", "rect#r updated: stroke-width=2"],
      ["undo", "rect#r updated: stroke-width removed"],
      ['create text t 0 0 "My Diagram"', "text#t created"],
      ['set t text "a b"', 'text#t updated: text="a b"'],
      ["set r fill #ffffff", "rect#r updated: fill=#ffffff"],
    ]);
    assert.equal(editor.document?.toSvg().includes('stroke-width="'), false);
    assert.match(editor.document?.toSvg() ?? "", /fill="#ffffff"/);
  });

  it("scales and moves a group without a second copy of the factor", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create g node", "g#node created"],
      ["create rect r 10 20 1 1 in node", "rect#r created in g#node"],
      ["scale node 2", "g#node scaled by 2"],
      ["undo", "g#node scaled back by 0.5"],
      ["redo", "g#node scaled by 2"],
    ]);
    assert.deepEqual(run(editor, "show r"), [
      ["rect#r  parent=g#node", "  x=20 y=40 width=2 height=2"].join("\n"),
    ]);
  });

  it("restores deleted groups, including nested children, as one undo unit", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect a 0 0 1 1", "rect#a created"],
      ["create rect b 1 1 1 1", "rect#b created"],
      ["create rect c 2 2 1 1", "rect#c created"],
      ["delete b", "rect#b deleted"],
    ]);
    assert.match(editor.document?.renderTree() ?? "", /rect#a[\s\S]*rect#c/);
    assert.equal(editor.document?.renderTree().includes("rect#b"), false);
    replay(editor, [
      ["undo", "rect#b restored into svg"],
      ["redo", "rect#b deleted"],
      ["undo", "rect#b restored into svg"],
    ]);
    const tree = editor.document?.renderTree() ?? "";
    assert.ok(tree.indexOf("rect#a") < tree.indexOf("rect#b"));
    assert.ok(tree.indexOf("rect#b") < tree.indexOf("rect#c"));

    replay(editor, [
      ["create g outer", "g#outer created"],
      ["create g inner in outer", "g#inner created in g#outer"],
      ["create circle dot 0 0 1 in inner", "circle#dot created in g#inner"],
      ["delete outer", "g#outer deleted"],
    ]);
    assert.equal(editor.document?.find("dot"), undefined);
    replay(editor, [
      ["undo", "g#outer restored into svg"],
      ["redo", "g#outer deleted"],
      ["undo", "g#outer restored into svg"],
    ]);
    assert.deepEqual(run(editor, "show dot"), [
      ["circle#dot  parent=g#inner", "  cx=0 cy=0 r=1"].join("\n"),
    ]);
  });

  it("parses the in clause only when a container id follows it", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ['create text t 10 20 "in"', "text#t created"],
      ["create line a 0 0 1 1 in", "line#a created"],
      ["create g node1", "g#node1 created"],
      ['create text hello 10 20 "hello" in node1', "text#hello created in g#node1"],
    ]);
    assert.deepEqual(run(editor, "show t"), [
      ['text#t  parent=svg', "  x=10 y=20", '  text="in"'].join("\n"),
    ]);
    assert.deepEqual(run(editor, "show a"), [
      ["line#a  parent=svg", "  x1=0 y1=0 x2=1 y2=1", "  stroke=in"].join("\n"),
    ]);
    assert.deepEqual(run(editor, "show hello"), [
      ['text#hello  parent=g#node1', "  x=10 y=20", '  text="hello"'].join("\n"),
    ]);
  });

  it("locks undo after init until the next successful edit, and a new edit clears redo", () => {
    const editor = session();
    editor.setFilePath("demo.svg");
    assert.deepEqual(run(editor, "init"), ["canvas 800x600 created"]);
    assert.equal(editor.filePath, null);
    assert.equal(editor.historyLocked, true);
    assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);
    assert.deepEqual(run(editor, "redo"), ["error: undo not allowed after io command"]);
    assert.deepEqual(run(editor, "help"), [run(session(), "help")[0]]);
    assert.equal(editor.historyLocked, true);
    replay(editor, [["create rect r 0 0 1 1", "rect#r created"]]);
    assert.equal(editor.historyLocked, false);
    const kept = fingerprint(editor);
    assert.deepEqual(run(editor, "init 0 1"), ["error: size must be positive"]);
    assert.deepEqual(run(editor, "init bad 1"), ["error: size must be positive"]);
    assert.equal(fingerprint(editor), kept);
    replay(editor, [
      ["undo", "rect#r removed"],
      ["redo", "rect#r created"],
      ["move r 1 0", "rect#r moved to (1,0)"],
      ["undo", "rect#r moved back to (0,0)"],
      ["set r fill red", "rect#r updated: fill=red"],
    ]);
    assert.equal(editor.redoDepth, 0);
    assert.deepEqual(run(editor, "redo"), ["error: nothing to redo"]);
    replay(editor, [
      ["undo", "rect#r updated: fill removed"],
      ["undo", "rect#r removed"],
      ["undo", "error: nothing to undo"],
    ]);
  });

  it("replaces the document on a later init and forgets the old undo stack", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect old 0 0 1 1", "rect#old created"],
      ["init 400 300", "canvas 400x300 created"],
    ]);
    assert.equal(editor.historyLocked, true);
    assert.equal(editor.undoDepth, 0);
    assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);
    replay(editor, [
      ["create rect q 0 0 1 1", "rect#q created"],
      ["undo", "rect#q removed"],
      ["undo", "error: nothing to undo"],
    ]);
    assert.equal(editor.document?.find("old"), undefined);
    assert.equal(editor.document?.width, 400);
  });

  it("does not let a query consume the redo stack", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create circle c 0 0 1", "circle#c created"],
      ["undo", "circle#c removed"],
    ]);
    assert.equal(editor.redoDepth, 1);
    run(editor, "tree");
    run(editor, "help");
    assert.equal(editor.redoDepth, 1);
    assert.equal(editor.historyLocked, false);
    replay(editor, [["redo", "circle#c created"]]);
  });

  it("does not record queries, and a failed command leaves the tree and history alone", () => {
    const editor = session();
    replay(editor, [
      ["init 800 600", "canvas 800x600 created"],
      ["create rect bg 0 0 10 10", "rect#bg created"],
      ["create circle c1 1 2 3", "circle#c1 created"],
    ]);
    const subtree = editor.document?.renderTree("c1");
    assert.equal(subtree, "circle#c1  cx=1 cy=2 r=3");
    assert.deepEqual(run(editor, "tree c1"), [subtree]);
    const before = fingerprint(editor);
    const failures: readonly (readonly [string, string])[] = [
      ["create", "error: usage: create <type> <id> [params...] [in <containerId>]"],
      ["create rect", "error: usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]"],
      ["create hexagon", "error: unknown shape type: hexagon (is the plugin loaded?)"],
      ["create hexagon h 1", "error: unknown shape type: hexagon (is the plugin loaded?)"],
      ["create rect bg 1 2 3 4", "error: id already exists: bg"],
      ["create rect bg 0 0 1 1 in missing", "error: id already exists: bg"],
      ["create rect other 0 0 1 1 in c1", "error: not a container: c1"],
      ["create rect other 0 0 1 1 in missing", "error: no such container: missing"],
      ["create rect bad x 0 1 1", "error: invalid number: x"],
      ["delete", "error: usage: delete <id>"],
      ["delete a b", "error: usage: delete <id>"],
      ["delete missing", "error: no such shape: missing"],
      ["move c1 1", "error: usage: move <id> <dx> <dy>"],
      ["move c1 foo 1", "error: invalid number: foo"],
      ["scale c1", "error: usage: scale <id> <factor>"],
      ["scale c1 0", "error: scale factor must be positive"],
      ["scale c1 -2", "error: scale factor must be positive"],
      ["scale missing 2", "error: no such shape: missing"],
      ["set c1 fill", "error: usage: set <id> <attr> <value>"],
      ["set c1 Fill red", "error: unknown attribute: Fill"],
      ["set missing x 1", "error: no such shape: missing"],
      ["tree missing", "error: no such shape: missing"],
      ["tree a b", "error: usage: tree [id]"],
      ["show", "error: usage: show <id>"],
      ["show missing", "error: no such shape: missing"],
      ["undo extra", "error: usage: undo"],
      ["redo extra", "error: usage: redo"],
    ];
    for (const [line, expected] of failures) {
      assert.deepEqual(run(editor, line), [expected], line);
      assert.equal(fingerprint(editor), before, line);
    }
    assert.deepEqual(run(editor, "# comment"), []);
    assert.deepEqual(run(editor, ""), []);
    assert.equal(fingerprint(editor), before);
    replay(editor, [
      ["undo", "circle#c1 removed"],
      ["undo", "rect#bg removed"],
      ["undo", "error: nothing to undo"],
    ]);
  });
});

class NoteCommand extends Command {
  constructor(
    private readonly forward: string,
    private readonly back: string,
  ) {
    super([]);
  }

  override execute(_ctx: EditorContext): CommandResult {
    return { message: this.forward, warnings: [], effect: "record" };
  }

  override undo(): string {
    return this.back;
  }
}

describe("CommandHistory", () => {
  it("keeps earlier edits when locked and prefers the lock over an empty stack", () => {
    const history = new CommandHistory();
    const ctx = session();
    assert.throws(
      () => history.undo(),
      (error: unknown) => error instanceof CommandError && error.message === "nothing to undo",
    );
    const first = new NoteCommand("first", "undo first");
    const second = new NoteCommand("second", "undo second");
    history.apply("record", first);
    history.apply("record", second);
    assert.equal(history.undo(), "undo second");
    history.apply("lock", second);
    assert.equal(history.locked, true);
    assert.equal(history.undoDepth, 1);
    assert.equal(history.redoDepth, 0);
    assert.throws(
      () => history.undo(),
      (error: unknown) =>
        error instanceof CommandError && error.message === "undo not allowed after io command",
    );
    assert.throws(
      () => history.redo(ctx),
      (error: unknown) =>
        error instanceof CommandError && error.message === "undo not allowed after io command",
    );
    const third = new NoteCommand("third", "undo third");
    history.apply("record", third);
    assert.equal(history.locked, false);
    assert.equal(history.undo(), "undo third");
    assert.equal(history.undo(), "undo first");
    assert.equal(history.redo(ctx), "first");
    history.apply("reset", first);
    assert.equal(history.locked, true);
    assert.equal(history.undoDepth, 0);
    assert.equal(history.redoDepth, 0);
    assert.throws(
      () => history.undo(),
      (error: unknown) =>
        error instanceof CommandError && error.message === "undo not allowed after io command",
    );
  });
});
