import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { EditorSession } from "../src/app/EditorSession";

const fixtures = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

const OTHER_TREE = `svg (400x300)
├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff
├── text#t1        (10,290) "imported"
├── circle#c1      cx=50 cy=50 r=10
├── g#g1
│   ├── rect#r2    x=0 y=0 w=10 h=10
│   └── circle#c2  cx=5 cy=5 r=2
└── ellipse#e1     cx=1 cy=2 rx=3 ry=4`;

const MINIMAL = readFileSync(path.join(fixtures, "minimal.svg"), "utf8");

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

function withDirectory(body: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), "svg-editor-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function quote(file: string): string {
  return `"${file}"`;
}

function assertNoTemporary(dir: string): void {
  for (const name of readdirSync(dir)) {
    assert.equal(name.endsWith(".tmp"), false, name);
  }
}

describe("svg io", { concurrency: 1 }, () => {
  it("writes the 0.1 svg bytes and reads them back unchanged", () => {
    withDirectory(dir => {
      const editor = session();
      const file = path.join(dir, "minimal.svg");
      replay(editor, [
        ["init 400 200", "canvas 400x200 created"],
        ["create g flow", "g#flow created"],
        ["create rect start 30 70 120 60 #4a90d9 in flow", "rect#start created in g#flow"],
        ["create line edge 150 100 250 100 black in flow", "line#edge created in g#flow"],
        ["create rect end 250 70 120 60 #f5a623 in flow", "rect#end created in g#flow"],
        [`save ${quote(file)}`, `saved to ${file} (4 elements)`],
      ]);
      assert.equal(readFileSync(file, "utf8"), MINIMAL);
      assert.equal(editor.filePath, file);
      assert.equal(editor.historyLocked, true);
      assertNoTemporary(dir);

      const again = path.join(dir, "again.svg");
      const reread = session();
      assert.deepEqual(run(reread, `read ${quote(file)}`), [`read ${file} (4 elements)`]);
      assert.equal(reread.document?.toSvg(), MINIMAL);
      assert.deepEqual(run(reread, `save ${quote(again)}`), [`saved to ${again} (4 elements)`]);
      assert.equal(readFileSync(again, "utf8"), MINIMAL);
      assert.equal(readFileSync(path.join(fixtures, "minimal.svg"), "utf8"), MINIMAL);
    });
  });

  it("formats 10.0 as 10 and escapes text on a later save", () => {
    withDirectory(dir => {
      const source = path.join(dir, "loose.svg");
      writeFileSync(
        source,
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<svg width="10.0" height="20px" viewBox="0 0 10 20">',
          '  <rect id="r" x="10.0" y="0" width="1" height="1" stroke-width="2.50"/>',
          '  <text id="t" x="0" y="1">a &amp; b &lt;c&gt;</text>',
          "</svg>",
          "",
        ].join("\n"),
        "utf8",
      );
      const editor = session();
      assert.deepEqual(run(editor, `read ${quote(source)}`), [`read ${source} (2 elements)`]);
      const saved = path.join(dir, "tight.svg");
      assert.deepEqual(run(editor, `save ${quote(saved)}`), [`saved to ${saved} (2 elements)`]);
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20" viewBox="0 0 10 20">
  <rect id="r" x="10" y="0" width="1" height="1" stroke-width="2.5"/>
  <text id="t" x="0" y="1">a &amp; b &lt;c&gt;</text>
</svg>
`;
      assert.equal(readFileSync(saved, "utf8"), expected);
      const round = session();
      assert.deepEqual(run(round, `read ${quote(saved)}`), [`read ${saved} (2 elements)`]);
      const copy = path.join(dir, "copy.svg");
      assert.deepEqual(run(round, `save ${quote(copy)}`), [`saved to ${copy} (2 elements)`]);
      assert.equal(readFileSync(copy, "utf8"), expected);
    });
  });

  it("reads other.svg, assigns the missing id, and prints the section 9 tree", () => {
    withDirectory(dir => {
      const file = path.join(dir, "other.svg");
      copyFileSync(path.join(fixtures, "other.svg"), file);
      const editor = session();
      assert.deepEqual(run(editor, `read ${quote(file)}`), [
        "warning: assigned id rect1 to unnamed <rect>",
        `read ${file} (7 elements)`,
      ]);
      assert.equal(editor.filePath, file);
      assert.equal(editor.historyLocked, true);
      assert.equal(editor.undoDepth, 0);
      assert.deepEqual(run(editor, "tree"), [OTHER_TREE]);
      assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);

      const saved = path.join(dir, "stored.svg");
      assert.deepEqual(run(editor, `save ${quote(saved)}`), [`saved to ${saved} (7 elements)`]);
      const again = session();
      assert.deepEqual(run(again, `read ${quote(saved)}`), [`read ${saved} (7 elements)`]);
      assert.equal(again.document?.toSvg(), readFileSync(saved, "utf8"));
    });
  });

  it("replays the latter half of section 6, then drops the old undo stack", () => {
    withDirectory(dir => {
      const previous = process.cwd();
      process.chdir(dir);
      try {
        copyFileSync(path.join(fixtures, "other.svg"), path.join(dir, "other.svg"));
        const editor = session();
        replay(editor, [
          ["init 800 600", "canvas 800x600 created"],
          ["create rect bg 0 0 800 600 #ffffff", "rect#bg created"],
          ['create text title 20 40 "My Diagram"', "text#title created"],
          ["create circle c1 100 100 20 red", "circle#c1 created"],
          ["create rect box 200 80 60 60 #3366ff", "rect#box created"],
          ["group markers c1 box", "g#markers created with 2 children"],
          ["move c1 30 0", "circle#c1 moved to (130,100)"],
          ["undo", "circle#c1 moved back to (100,100)"],
          ["redo", "circle#c1 moved to (130,100)"],
          ['set title text "My Diagram v2"', 'text#title updated: text="My Diagram v2"'],
          ["undo", 'text#title updated: text="My Diagram"'],
          ["delete box", "rect#box deleted"],
          ["undo", "rect#box restored into g#markers"],
        ]);
        assert.equal(editor.undoDepth, 6);
        assert.deepEqual(run(editor, "save demo.svg"), ["saved to demo.svg (5 elements)"]);
        assert.equal(editor.filePath, "demo.svg");
        assert.equal(editor.historyLocked, true);
        assert.equal(editor.redoDepth, 0);
        assert.equal(editor.undoDepth, 6);
        const saved = fingerprint(editor);
        assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);
        assert.deepEqual(run(editor, "redo"), ["error: undo not allowed after io command"]);
        assert.deepEqual(run(editor, "tree"), [editor.document?.renderTree()]);
        assert.equal(fingerprint(editor), saved);
        assert.match(readFileSync(path.join(dir, "demo.svg"), "utf8"), /cx="130"/);

        assert.deepEqual(run(editor, "read other.svg"), [
          "warning: assigned id rect1 to unnamed <rect>",
          "read other.svg (7 elements)",
        ]);
        assert.deepEqual(run(editor, "tree"), [OTHER_TREE]);
        assert.equal(editor.filePath, "other.svg");
        assert.equal(editor.undoDepth, 0);
        assert.equal(editor.historyLocked, true);
        assert.equal(editor.document?.find("bg"), undefined);
        assert.ok(editor.document?.find("rect1"));
        replay(editor, [
          ["create rect q 0 0 1 1", "rect#q created"],
          ["undo", "rect#q removed"],
          ["undo", "error: nothing to undo"],
        ]);
      } finally {
        process.chdir(previous);
      }
    });
  });

  it("keeps earlier edits undoable after save, until init replaces the document", () => {
    withDirectory(dir => {
      const file = path.join(dir, "a.svg");
      const editor = session();
      replay(editor, [
        ["init", "canvas 800x600 created"],
        ["create rect r 0 0 1 1", "rect#r created"],
        [`save ${quote(file)}`, `saved to ${file} (1 elements)`],
      ]);
      assert.equal(editor.historyLocked, true);
      assert.equal(editor.undoDepth, 1);
      const locked = fingerprint(editor);
      assert.deepEqual(run(editor, "help"), [run(session(), "help")[0]]);
      assert.equal(fingerprint(editor), locked);
      replay(editor, [
        ["move r 1 0", "rect#r moved to (1,0)"],
        ["undo", "rect#r moved back to (0,0)"],
        ["undo", "rect#r removed"],
        ["undo", "error: nothing to undo"],
      ]);
      assert.equal(editor.document?.find("r"), undefined);
      assert.equal(readFileSync(file, "utf8").includes('id="r"'), true);
      replay(editor, [
        ["create rect r 0 0 1 1", "rect#r created"],
        ["init 400 300", "canvas 400x300 created"],
      ]);
      assert.equal(editor.filePath, null);
      assert.equal(editor.undoDepth, 0);
      assert.equal(editor.historyLocked, true);
      assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);
      assert.equal(editor.document?.find("r"), undefined);
    });
  });

  it("queries canvas without locking, and keeps a resized canvas when edits are undone", () => {
    withDirectory(() => {
      const editor = session();
      replay(editor, [["init 800 600", "canvas 800x600 created"]]);
      assert.deepEqual(run(editor, "canvas"), ["canvas 800x600"]);
      assert.equal(editor.historyLocked, true);
      assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);
      replay(editor, [["create rect r 0 0 10 20", "rect#r created"]]);
      assert.deepEqual(run(editor, "canvas"), ["canvas 800x600"]);
      assert.equal(editor.historyLocked, false);
      const before = fingerprint(editor);
      assert.deepEqual(run(editor, "canvas 10"), ["error: usage: canvas [w] [h]"]);
      assert.deepEqual(run(editor, "canvas 0 10"), ["error: size must be positive"]);
      assert.deepEqual(run(editor, "canvas -1 10"), ["error: size must be positive"]);
      assert.deepEqual(run(editor, "canvas bad 10"), ["error: size must be positive"]);
      assert.equal(fingerprint(editor), before);
      replay(editor, [["canvas 10.50 20", "canvas resized to 10.5x20"]]);
      assert.equal(editor.historyLocked, true);
      assert.equal(editor.undoDepth, 1);
      assert.deepEqual(run(editor, "undo"), ["error: undo not allowed after io command"]);
      assert.deepEqual(run(editor, "canvas"), ["canvas 10.5x20"]);
      replay(editor, [
        ["move r 1 0", "rect#r moved to (1,0)"],
        ["undo", "rect#r moved back to (0,0)"],
        ["undo", "rect#r removed"],
      ]);
      assert.equal(editor.document?.width, 10.5);
      assert.equal(editor.document?.height, 20);
      assert.deepEqual(run(editor, "canvas"), ["canvas 10.5x20"]);

      const cleared = session();
      replay(cleared, [
        ["init", "canvas 800x600 created"],
        ["create rect r 0 0 1 1", "rect#r created"],
        ["undo", "rect#r removed"],
      ]);
      assert.equal(cleared.redoDepth, 1);
      assert.deepEqual(run(cleared, "canvas"), ["canvas 800x600"]);
      assert.equal(cleared.redoDepth, 1);
      assert.deepEqual(run(cleared, "canvas 800 600"), ["canvas resized to 800x600"]);
      assert.equal(cleared.redoDepth, 0);
      assert.equal(cleared.historyLocked, true);
      assert.deepEqual(run(cleared, "redo"), ["error: undo not allowed after io command"]);
      assert.deepEqual(run(cleared, "undo"), ["error: undo not allowed after io command"]);
    });
  });

  it("strips px, ignores transform, and assigns ids without colliding", () => {
    withDirectory(dir => {
      const file = path.join(dir, "foreign.svg");
      writeFileSync(
        file,
        [
          '<svg xmlns="http://www.w3.org/2000/svg" width="80px" viewBox="0, 0, 1, 40" style="opacity:1" data-x="b">',
          '  <g id="diagram" transform="translate(60,40)" style="opacity:0.2">',
          '    <rect id="a" x="0" y="0px" width="120" height="60" fill="#4a90d9" stroke-width="2px" extra="1"/>',
          '    <text id="label" x="10.0" y="20px" font-size="16" text-anchor="middle">End</text>',
          "  </g>",
          '  <rect id="rect1" x="0" y="0" width="1" height="1"/>',
          "  <g>",
          '    <rect id="   " x="1" y="1" width="1" height="1"/>',
          "  </g>",
          "</svg>",
        ].join("\n"),
        "utf8",
      );
      const editor = session();
      assert.deepEqual(run(editor, `read ${quote(file)}`), [
        "warning: ignored attribute style on svg",
        "warning: ignored attribute data-x on svg",
        "warning: ignored attribute transform on g#diagram",
        "warning: ignored attribute style on g#diagram",
        "warning: ignored attribute extra on rect#a",
        "warning: ignored attribute font-size on text#label",
        "warning: ignored attribute text-anchor on text#label",
        "warning: assigned id g1 to unnamed <g>",
        "warning: assigned id rect2 to unnamed <rect>",
        `read ${file} (6 elements)`,
      ]);
      assert.deepEqual(run(editor, "canvas"), ["canvas 80x40"]);
      assert.deepEqual(run(editor, "show a"), [
        ["rect#a  parent=g#diagram", "  x=0 y=0 width=120 height=60", "  fill=#4a90d9 stroke-width=2"].join(
          "\n",
        ),
      ]);
      assert.deepEqual(run(editor, "show label"), [
        ['text#label  parent=g#diagram', "  x=10 y=20", '  text="End"'].join("\n"),
      ]);
      assert.equal(editor.document?.find("rect1")?.parent, editor.document);
      assert.ok(editor.document?.find("rect2"));
      assert.equal(editor.document?.find("g1")?.asContainer()?.childCount(), 1);
    });
  });

  it("leaves the document, path, and history unchanged when read, save, or canvas fails", () => {
    withDirectory(dir => {
      const fresh = session();
      assert.deepEqual(run(fresh, "init"), ["canvas 800x600 created"]);
      assert.deepEqual(run(fresh, "save"), ["error: no file path. use 'save <file.svg>'"]);
      assert.equal(fresh.filePath, null);
      assert.equal(fresh.historyLocked, true);

      const kept = path.join(dir, "kept.svg");
      const editor = session();
      replay(editor, [
        ["init 800 600", "canvas 800x600 created"],
        ["create rect r 0 0 1 1", "rect#r created"],
        [`save ${quote(kept)}`, `saved to ${kept} (1 elements)`],
        ["move r 1 0", "rect#r moved to (1,0)"],
      ]);
      const bytes = readFileSync(kept, "utf8");
      const before = fingerprint(editor);
      const missing = path.join(dir, "missing.svg");
      const nested = path.join(dir, "no-such-dir", "a.svg");
      const failures: readonly (readonly [string, string])[] = [
        [`read ${quote(missing)}`, `error: cannot read file: ${missing}`],
        ["save a.svg b.svg", "error: usage: save [file.svg]"],
        [`save ${quote(nested)}`, `error: cannot write file: ${nested}`],
        ["canvas 0 1", "error: size must be positive"],
      ];
      writeFileSync(
        path.join(dir, "bad-root.svg"),
        '<notsvg width="10" height="10"/>',
        "utf8",
      );
      writeFileSync(path.join(dir, "no-size.svg"), "<svg><!-- empty --></svg>", "utf8");
      writeFileSync(path.join(dir, "percent.svg"), '<svg width="100%" height="10"/>', "utf8");
      writeFileSync(path.join(dir, "title.svg"), '<svg width="10" height="10"><title>x</title></svg>', "utf8");
      writeFileSync(
        path.join(dir, "defs.svg"),
        '<svg width="10" height="10"><rect x="0" y="0" width="1" height="1"/><defs/></svg>',
        "utf8",
      );
      writeFileSync(
        path.join(dir, "dup.svg"),
        '<svg width="10" height="10"><rect id="a" x="0" y="0" width="1" height="1"/><rect id="a" x="1" y="0" width="1" height="1"/></svg>',
        "utf8",
      );
      writeFileSync(
        path.join(dir, "child.svg"),
        '<svg width="10" height="10"><text id="t" x="0" y="1"><tspan>a</tspan></text></svg>',
        "utf8",
      );
      writeFileSync(
        path.join(dir, "missing-attr.svg"),
        '<svg width="10" height="10"><ellipse id="e" cx="1" cy="2" rx="3"/></svg>',
        "utf8",
      );
      writeFileSync(path.join(dir, "broken.svg"), "<svg>", "utf8");
      writeFileSync(path.join(dir, "mismatch.svg"), '<svg width="10" height="10"><rect></svg>', "utf8");
      writeFileSync(path.join(dir, "zero.svg"), '<svg width="0" height="10"/>', "utf8");
      writeFileSync(path.join(dir, "short-box.svg"), '<svg viewBox="0 0 10"/>', "utf8");
      const rejected: readonly (readonly [string, string])[] = [
        [`read ${quote(path.join(dir, "bad-root.svg"))}`, "error: invalid svg: root element is not svg"],
        [`read ${quote(path.join(dir, "no-size.svg"))}`, "error: invalid svg: missing canvas size"],
        [`read ${quote(path.join(dir, "percent.svg"))}`, "error: invalid svg: unsupported length: 100%"],
        [`read ${quote(path.join(dir, "title.svg"))}`, "error: unsupported element: title"],
        [`read ${quote(path.join(dir, "defs.svg"))}`, "error: unsupported element: defs"],
        [`read ${quote(path.join(dir, "dup.svg"))}`, "error: id already exists: a"],
        [`read ${quote(path.join(dir, "child.svg"))}`, "error: unsupported element: tspan"],
        [`read ${quote(path.join(dir, "missing-attr.svg"))}`, "error: invalid svg: missing attribute: ry"],
        [`read ${quote(path.join(dir, "broken.svg"))}`, "error: invalid svg: unclosed xml tag(s): svg"],
        [
          `read ${quote(path.join(dir, "mismatch.svg"))}`,
          'error: invalid svg: Opening and ending tag mismatch: "rect" != "svg"',
        ],
        [`read ${quote(path.join(dir, "zero.svg"))}`, "error: size must be positive"],
        [`read ${quote(path.join(dir, "short-box.svg"))}`, "error: invalid svg: missing canvas size"],
      ];
      for (const [line, expected] of [...failures, ...rejected]) {
        assert.deepEqual(run(editor, line), [expected], line);
        assert.equal(fingerprint(editor), before, line);
        assert.equal(readFileSync(kept, "utf8"), bytes, line);
      }
      assert.equal(editor.filePath, kept);
      assertNoTemporary(dir);

      writeFileSync(path.join(dir, "old.svg"), "old", "utf8");
      chmodSync(dir, 0o555);
      try {
        const old = path.join(dir, "old.svg");
        assert.deepEqual(run(editor, `save ${quote(old)}`), [`error: cannot write file: ${old}`]);
        assert.equal(readFileSync(old, "utf8"), "old");
        assert.equal(fingerprint(editor), before);
      } finally {
        chmodSync(dir, 0o755);
      }
    });
  });
});
