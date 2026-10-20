import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorSession } from "../src/app/EditorSession";

const FLAT_TREE = `svg (800x600)
├── rect#bg     x=0 y=0 w=800 h=600 fill=#ffffff
├── text#title  (20,40) "My Diagram"
├── circle#c1   cx=100 cy=100 r=20 fill=red
└── rect#box    x=200 y=80 w=60 h=60 fill=#3366ff`;

const GROUPED_TREE = `svg (800x600)
├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff
├── text#title     (20,40) "My Diagram"
└── g#markers
    ├── circle#c1  cx=100 cy=100 r=20 fill=red
    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff`;

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

function svg(editor: EditorSession): string {
  return editor.document?.toSvg() ?? "";
}

function assertOrder(text: string, ids: readonly string[]): void {
  let previous = -1;
  for (const id of ids) {
    const index = text.indexOf(`id="${id}"`);
    assert.ok(index >= 0, id);
    assert.ok(index > previous, `${id} follows the previous id`);
    previous = index;
  }
}

describe("hierarchy", () => {
  it("groups the section 6 sample as one undo unit", () => {
    const editor = session();
    replay(editor, [
      ["init 800 600", "canvas 800x600 created"],
      ["create rect bg 0 0 800 600 #ffffff", "rect#bg created"],
      ['create text title 20 40 "My Diagram"', "text#title created"],
      ["create circle c1 100 100 20 red", "circle#c1 created"],
      ["create rect box 200 80 60 60 #3366ff", "rect#box created"],
      ["group markers c1 box", "g#markers created with 2 children"],
    ]);
    assert.equal(editor.document?.elementCount(), 5);
    assert.equal(editor.document?.renderTree(), GROUPED_TREE);
    assert.equal(svg(editor).includes("transform"), false);
    assert.deepEqual(run(editor, "show c1"), [
      ["circle#c1  parent=g#markers", "  cx=100 cy=100 r=20", "  fill=red"].join("\n"),
    ]);
    const grouped = fingerprint(editor);
    assert.deepEqual(run(editor, "group bad c1 markers"), [
      "error: cannot group a container into its own descendant: markers",
    ]);
    assert.equal(fingerprint(editor), grouped);
    replay(editor, [
      ["delete box", "rect#box deleted"],
      ["undo", "rect#box restored into g#markers"],
      ["undo", "g#markers removed"],
    ]);
    assert.equal(editor.document?.renderTree(), FLAT_TREE);
    assert.equal(editor.document?.elementCount(), 4);
    replay(editor, [["redo", "g#markers created with 2 children"]]);
    assert.equal(editor.document?.renderTree(), GROUPED_TREE);
    assert.equal(editor.document?.elementCount(), 5);
    replay(editor, [
      ["undo", "g#markers removed"],
      ["set bg x 1", "rect#bg updated: x=1"],
    ]);
    assert.deepEqual(run(editor, "redo"), ["error: nothing to redo"]);
    assert.equal(editor.document?.find("markers"), undefined);
  });

  it("orders group members by document order and keeps a following sibling outside", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect bg 0 0 1 1", "rect#bg created"],
      ["create circle c1 0 0 1", "circle#c1 created"],
      ['create text title 0 0 "t"', "text#title created"],
      ["create rect box 1 1 1 1", "rect#box created"],
      ["group markers box c1", "g#markers created with 2 children"],
    ]);
    const tree = editor.document?.renderTree() ?? "";
    assert.ok(tree.indexOf("rect#bg") < tree.indexOf("g#markers"));
    assert.ok(tree.indexOf("g#markers") < tree.indexOf("circle#c1"));
    assert.ok(tree.indexOf("circle#c1") < tree.indexOf("rect#box"));
    assert.ok(tree.indexOf("rect#box") < tree.indexOf("text#title"));
    assert.deepEqual(run(editor, "show title"), [
      ['text#title  parent=svg', "  x=0 y=0", '  text="t"'].join("\n"),
    ]);
    assertOrder(svg(editor), ["bg", "markers", "c1", "box", "title"]);
  });

  it("groups by document order when arguments and parents both differ", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create circle c1 0 0 1", "circle#c1 created"],
      ["create rect box 1 1 1 1", "rect#box created"],
      ["create ellipse extra 2 2 1 1", "ellipse#extra created"],
      ["group g extra box c1", "g#g created with 3 children"],
    ]);
    assertOrder(svg(editor), ["g", "c1", "box", "extra"]);
    const flat = editor.undoDepth;
    replay(editor, [["undo", "g#g removed"]]);
    assert.equal(editor.undoDepth, flat - 1);
    assert.equal(editor.document?.find("g"), undefined);
    assertOrder(svg(editor), ["c1", "box", "extra"]);
    replay(editor, [["redo", "g#g created with 3 children"]]);
    assert.equal(editor.document?.elementCount(), 4);
    assertOrder(svg(editor), ["g", "c1", "box", "extra"]);

    const nested = session();
    replay(nested, [
      ["init", "canvas 800x600 created"],
      ["create g A", "g#A created"],
      ["create rect r1 0 0 1 1 in A", "rect#r1 created in g#A"],
      ["create rect keep 2 2 1 1 in A", "rect#keep created in g#A"],
      ["create g B", "g#B created"],
      ["create rect r2 3 3 1 1 in B", "rect#r2 created in g#B"],
      ["group g r2 r1", "g#g created with 2 children"],
    ]);
    assert.equal(nested.document?.elementCount(), 6);
    assert.deepEqual(run(nested, "show g"), [["g#g  parent=g#A", "  children=2"].join("\n")]);
    assert.deepEqual(run(nested, "show r1"), [
      ["rect#r1  parent=g#g", "  x=0 y=0 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(nested, "show r2"), [
      ["rect#r2  parent=g#g", "  x=3 y=3 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(nested, "show keep"), [
      ["rect#keep  parent=g#A", "  x=2 y=2 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(nested, "show B"), [["g#B  parent=svg", "  children=0"].join("\n")]);
    assertOrder(svg(nested), ["A", "g", "r1", "r2", "keep", "B"]);
    replay(nested, [["undo", "g#g removed"]]);
    assert.equal(nested.document?.elementCount(), 5);
    assert.equal(nested.document?.find("g"), undefined);
    assert.deepEqual(run(nested, "show r1"), [
      ["rect#r1  parent=g#A", "  x=0 y=0 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(nested, "show r2"), [
      ["rect#r2  parent=g#B", "  x=3 y=3 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(nested, "show keep"), [
      ["rect#keep  parent=g#A", "  x=2 y=2 width=1 height=1"].join("\n"),
    ]);
    replay(nested, [["redo", "g#g created with 2 children"]]);
    assert.equal(nested.document?.elementCount(), 6);
    assert.deepEqual(run(nested, "show r2"), [
      ["rect#r2  parent=g#g", "  x=3 y=3 width=1 height=1"].join("\n"),
    ]);
  });

  it("ungroups a nested group in place and rejects a top-level group", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create g scene", "g#scene created"],
      ["create rect before 0 0 1 1 in scene", "rect#before created in g#scene"],
      ["create g node in scene", "g#node created in g#scene"],
      ["create rect a 1 0 1 1 in node", "rect#a created in g#node"],
      ["create rect b 2 0 1 1 in node", "rect#b created in g#node"],
      ["create rect after 3 0 1 1 in scene", "rect#after created in g#scene"],
    ]);
    const before = fingerprint(editor);
    assert.deepEqual(run(editor, "ungroup scene"), [
      "error: cannot ungroup top-level container: scene",
    ]);
    assert.equal(fingerprint(editor), before);
    replay(editor, [["ungroup node", "g#node ungrouped"]]);
    assert.equal(editor.document?.find("node"), undefined);
    assert.deepEqual(run(editor, "show a"), [
      ["rect#a  parent=g#scene", "  x=1 y=0 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(editor, "show scene"), [["g#scene  parent=svg", "  children=4"].join("\n")]);
    assertOrder(svg(editor), ["scene", "before", "a", "b", "after"]);
    replay(editor, [
      ["undo", "g#node restored"],
      ["redo", "g#node ungrouped"],
      ["undo", "g#node restored"],
    ]);
    assert.deepEqual(run(editor, "show a"), [
      ["rect#a  parent=g#node", "  x=1 y=0 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(editor, "show node"), [["g#node  parent=g#scene", "  children=2"].join("\n")]);
    assertOrder(svg(editor), ["before", "node", "a", "b", "after"]);
    replay(editor, [
      ["create g empty in scene", "g#empty created in g#scene"],
      ["ungroup empty", "g#empty ungrouped"],
    ]);
    assert.equal(editor.document?.find("empty"), undefined);
    replay(editor, [["undo", "g#empty restored"]]);
    assert.deepEqual(run(editor, "show empty"), [["g#empty  parent=g#scene", "  children=0"].join("\n")]);
  });

  it("moves a shape to the end of a group and refuses a cycle", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create g outer", "g#outer created"],
      ["create g inner in outer", "g#inner created in g#outer"],
      ["create rect r 0 0 1 1 in inner", "rect#r created in g#inner"],
    ]);
    const depth = editor.undoDepth;
    const before = fingerprint(editor);
    assert.deepEqual(run(editor, "addto inner outer"), [
      "error: cannot add a container into its own descendant: outer",
    ]);
    assert.deepEqual(run(editor, "addto outer outer"), [
      "error: cannot add a container into its own descendant: outer",
    ]);
    assert.deepEqual(run(editor, "addto inner inner"), [
      "error: cannot add a container into its own descendant: inner",
    ]);
    assert.equal(fingerprint(editor), before);
    const tree = editor.document?.renderTree();
    const file = svg(editor);
    replay(editor, [["addto inner r", "rect#r added to g#inner"]]);
    assert.equal(editor.undoDepth, depth + 1);
    assertOrder(svg(editor), ["outer", "inner", "r"]);
    replay(editor, [["undo", "rect#r moved back to g#inner"]]);
    assert.equal(editor.document?.renderTree(), tree);
    assert.equal(svg(editor), file);
    assert.equal(editor.undoDepth, depth);
    assert.equal(editor.redoDepth, 1);
    replay(editor, [
      ["addto outer r", "rect#r added to g#outer"],
    ]);
    assert.deepEqual(run(editor, "show r"), [
      ["rect#r  parent=g#outer", "  x=0 y=0 width=1 height=1"].join("\n"),
    ]);
    assert.deepEqual(run(editor, "show inner"), [["g#inner  parent=g#outer", "  children=0"].join("\n")]);
    assertOrder(svg(editor), ["outer", "inner", "r"]);
    replay(editor, [["undo", "rect#r moved back to g#inner"]]);
    assert.deepEqual(run(editor, "show r"), [
      ["rect#r  parent=g#inner", "  x=0 y=0 width=1 height=1"].join("\n"),
    ]);

    const moved = session();
    replay(moved, [
      ["init", "canvas 800x600 created"],
      ["create g markers", "g#markers created"],
      ["create rect box 0 0 1 1 in markers", "rect#box created in g#markers"],
      ["create rect tail 1 1 1 1 in markers", "rect#tail created in g#markers"],
      ["create circle c 10 20 3 red", "circle#c created"],
      ["addto markers c", "circle#c added to g#markers"],
    ]);
    assertOrder(svg(moved), ["markers", "box", "tail", "c"]);
    replay(moved, [["undo", "circle#c moved back to svg"]]);
    assert.deepEqual(run(moved, "show c"), [
      ["circle#c  parent=svg", "  cx=10 cy=20 r=3", "  fill=red"].join("\n"),
    ]);
    replay(moved, [
      ["redo", "circle#c added to g#markers"],
      ["addto markers box", "rect#box added to g#markers"],
    ]);
    assertOrder(svg(moved), ["tail", "c", "box"]);
    replay(moved, [["undo", "rect#box moved back to g#markers"]]);
    assertOrder(svg(moved), ["box", "tail", "c"]);
  });

  it("writes front later in the file and back earlier, including inside one parent", () => {
    const editor = session();
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect a 0 0 1 1", "rect#a created"],
      ["create rect b 1 0 1 1", "rect#b created"],
      ["create rect c 2 0 1 1", "rect#c created"],
    ]);
    const original = svg(editor);
    const depth = editor.undoDepth;
    replay(editor, [["front c", "rect#c brought to front"]]);
    assert.equal(editor.undoDepth, depth + 1);
    assert.equal(svg(editor), original);
    replay(editor, [["undo", "rect#c z-order restored"]]);
    assert.equal(svg(editor), original);
    replay(editor, [["back a", "rect#a sent to back"]]);
    assert.equal(svg(editor), original);
    replay(editor, [["undo", "rect#a z-order restored"]]);
    replay(editor, [["front a", "rect#a brought to front"]]);
    assertOrder(svg(editor), ["b", "c", "a"]);
    replay(editor, [
      ["undo", "rect#a z-order restored"],
      ["redo", "rect#a brought to front"],
      ["back c", "rect#c sent to back"],
    ]);
    assertOrder(svg(editor), ["c", "b", "a"]);
    replay(editor, [["undo", "rect#c z-order restored"]]);
    assertOrder(svg(editor), ["b", "c", "a"]);

    const nested = session();
    replay(nested, [
      ["init", "canvas 800x600 created"],
      ["create rect outside 0 0 1 1", "rect#outside created"],
      ["create g p", "g#p created"],
      ["create rect a 1 0 1 1 in p", "rect#a created in g#p"],
      ["create rect b 2 0 1 1 in p", "rect#b created in g#p"],
      ["create rect tail 3 0 1 1", "rect#tail created"],
      ["front a", "rect#a brought to front"],
    ]);
    assert.deepEqual(run(nested, "show a"), [
      ["rect#a  parent=g#p", "  x=1 y=0 width=1 height=1"].join("\n"),
    ]);
    assertOrder(svg(nested), ["outside", "p", "b", "a", "tail"]);
    replay(nested, [["front p", "g#p brought to front"]]);
    assertOrder(svg(nested), ["outside", "tail", "p", "b", "a"]);
    assert.deepEqual(run(nested, "show a"), [
      ["rect#a  parent=g#p", "  x=1 y=0 width=1 height=1"].join("\n"),
    ]);
    replay(nested, [["undo", "g#p z-order restored"]]);
    assertOrder(svg(nested), ["outside", "p", "b", "a", "tail"]);
  });

  it("reports hierarchy errors in validation order and leaves state unchanged", () => {
    const editor = session();
    assert.deepEqual(run(editor, "group a b c"), ["error: no document. use 'init' or 'read' first"]);
    replay(editor, [
      ["init", "canvas 800x600 created"],
      ["create rect bg 0 0 1 1", "rect#bg created"],
      ["create g outer", "g#outer created"],
      ["create g inner in outer", "g#inner created in g#outer"],
      ["create circle c 0 0 1 in inner", "circle#c created in g#inner"],
      ["create rect box 1 1 1 1", "rect#box created"],
    ]);
    const before = fingerprint(editor);
    const failures: readonly (readonly [string, string])[] = [
      ["group", "error: usage: group <newGid> <id1> <id2>..."],
      ["group g", "error: usage: group <newGid> <id1> <id2>..."],
      ["group g c", "error: usage: group <newGid> <id1> <id2>..."],
      ["group c box bg", "error: id already exists: c"],
      ["group fresh missing box", "error: no such shape: missing"],
      ["group fresh missing missing", "error: no such shape: missing"],
      ["group fresh c c", "error: duplicate id: c"],
      ["group fresh inner inner", "error: duplicate id: inner"],
      ["group fresh c inner", "error: cannot group a container into its own descendant: inner"],
      ["group fresh inner c", "error: cannot group a container into its own descendant: inner"],
      ["group fresh c outer", "error: cannot group a container into its own descendant: outer"],
      ["group fresh c inner outer", "error: cannot group a container into its own descendant: inner"],
      ["group fresh c outer inner", "error: cannot group a container into its own descendant: outer"],
      ["ungroup", "error: usage: ungroup <gid>"],
      ["ungroup a b", "error: usage: ungroup <gid>"],
      ["ungroup missing", "error: no such shape: missing"],
      ["ungroup box", "error: not a container: box"],
      ["ungroup outer", "error: cannot ungroup top-level container: outer"],
      ["addto", "error: usage: addto <gid> <id>"],
      ["addto outer", "error: usage: addto <gid> <id>"],
      ["addto outer c extra", "error: usage: addto <gid> <id>"],
      ["addto missing c", "error: no such container: missing"],
      ["addto box missing", "error: not a container: box"],
      ["addto box c", "error: not a container: box"],
      ["addto inner missing", "error: no such shape: missing"],
      ["addto inner outer", "error: cannot add a container into its own descendant: outer"],
      ["addto outer outer", "error: cannot add a container into its own descendant: outer"],
      ["front", "error: usage: front <id>"],
      ["front a b", "error: usage: front <id>"],
      ["front missing", "error: no such shape: missing"],
      ["back", "error: usage: back <id>"],
      ["back a b", "error: usage: back <id>"],
      ["back missing", "error: no such shape: missing"],
    ];
    for (const [line, expected] of failures) {
      assert.deepEqual(run(editor, line), [expected], line);
      assert.equal(fingerprint(editor), before, line);
    }
    replay(editor, [["group markers c box", "g#markers created with 2 children"]]);
    assert.deepEqual(run(editor, "show c"), [
      ["circle#c  parent=g#markers", "  cx=0 cy=0 r=1"].join("\n"),
    ]);
  });
});
