import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { EditorSession } from "../src/app/EditorSession";
import { HelpText } from "../src/command/HelpText";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function helpFromPlan(): string {
  const text = readFileSync(path.join(root, "doc/实现计划.md"), "utf8");
  const slice = text.slice(text.indexOf("### 9.3 help"));
  const fence = "```text\n";
  const start = slice.indexOf(fence) + fence.length;
  const end = slice.indexOf("```", start);
  const block = slice.slice(start, end);
  return block.endsWith("\n") ? block.slice(0, -1) : block;
}

describe("EditorSession", () => {
  const session = new EditorSession();
  const noDocument = "error: no document. use 'init' or 'read' first";

  it("prints help without a document, matching section 9.3", () => {
    assert.equal(HelpText.body, helpFromPlan());
    assert.deepEqual(session.executeLine("help"), [HelpText.body]);
    assert.deepEqual(session.executeLine("  help\t"), [HelpText.body]);
  });

  it("rejects extra help arguments after the command is recognized", () => {
    assert.deepEqual(session.executeLine("help extra"), ["error: usage: help"]);
    assert.deepEqual(session.executeLine('help "x y"'), ["error: usage: help"]);
  });

  it("ignores blank lines and comments", () => {
    assert.deepEqual(session.executeLine(""), []);
    assert.deepEqual(session.executeLine(" \t "), []);
    assert.deepEqual(session.executeLine("# comment"), []);
    assert.deepEqual(session.executeLine("   # comment"), []);
  });

  it("reports an unknown command before the missing-document error", () => {
    assert.deepEqual(session.executeLine("foobar"), ["error: unknown command: foobar"]);
    assert.deepEqual(session.executeLine("Move"), ["error: unknown command: Move"]);
    assert.deepEqual(session.executeLine("exit"), ["error: unknown command: exit"]);
    assert.deepEqual(session.executeLine("__proto__"), ["error: unknown command: __proto__"]);
  });

  it("reports a missing document before usage for every editing command", () => {
    const names = [
      "save",
      "canvas",
      "create",
      "delete",
      "move",
      "scale",
      "set",
      "group",
      "ungroup",
      "addto",
      "front",
      "back",
      "tree",
      "show",
      "undo",
      "redo",
    ];
    for (const name of names) {
      assert.deepEqual(session.executeLine(name), [noDocument]);
      assert.deepEqual(session.executeLine(`${name} ???`), [noDocument]);
    }
    assert.deepEqual(session.executeLine("move"), [noDocument]);
    assert.deepEqual(session.executeLine("create hexagon"), [noDocument]);
  });

  it("checks usage for init and read, which do not need a document", () => {
    assert.deepEqual(session.executeLine("init 800"), ["error: usage: init [w] [h]"]);
    assert.deepEqual(session.executeLine("init 1 2 3"), ["error: usage: init [w] [h]"]);
    assert.deepEqual(session.executeLine("read"), ["error: usage: read <file.svg>"]);
    assert.deepEqual(session.executeLine("read a.svg b.svg"), ["error: usage: read <file.svg>"]);
  });

  it("does not turn an unclosed quote into a command error", () => {
    assert.deepEqual(session.executeLine('move "abc'), ["error: unclosed quote"]);
    assert.deepEqual(session.executeLine('"'), ["error: unclosed quote"]);
  });

  it("keeps the caller-supplied path string and resolves files from the working directory", () => {
    session.setFilePath("demo.svg");
    assert.equal(session.filePath, "demo.svg");
    assert.equal(session.resolvePath("a.svg"), path.resolve(process.cwd(), "a.svg"));
    assert.throws(() => session.replaceDocument({}, "a.svg"));
  });
});
