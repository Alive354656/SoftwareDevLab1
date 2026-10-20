import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CommandLineParser } from "../src/cli/CommandLineParser";
import { LineSyntaxError } from "../src/cli/LineSyntaxError";

describe("CommandLineParser", () => {
  const parser = new CommandLineParser();

  it("treats a blank line or a leading hash as no command", () => {
    assert.equal(parser.parse(""), null);
    assert.equal(parser.parse(" \t "), null);
    assert.equal(parser.parse("# create rect"), null);
    assert.equal(parser.parse("\t#x"), null);
    assert.equal(parser.parse("   # keep this out of the output"), null);
  });

  it("keeps a hash that is not the first token", () => {
    const parsed = parser.parse("create rect bg 0 0 800 600 #ffffff");
    assert.ok(parsed);
    assert.equal(parsed.name, "create");
    assert.deepEqual(parsed.args, ["rect", "bg", "0", "0", "800", "600", "#ffffff"]);
  });

  it("splits on spaces and tabs, and keeps quoted text as one argument", () => {
    const parsed = parser.parse('create text title 20 40 "My Diagram"');
    assert.ok(parsed);
    assert.equal(parsed.name, "create");
    assert.deepEqual(parsed.args, ["text", "title", "20", "40", "My Diagram"]);

    const tabbed = parser.parse("move\tid\t1\t2");
    assert.equal(tabbed?.name, "move");
    assert.deepEqual(tabbed?.args, ["id", "1", "2"]);
  });

  it("does not treat the in clause as syntax", () => {
    assert.deepEqual(parser.parse('create text t 10 20 "in"')?.args, [
      "text",
      "t",
      "10",
      "20",
      "in",
    ]);
    assert.deepEqual(parser.parse('create text t 10 20 "hello" in node1')?.args, [
      "text",
      "t",
      "10",
      "20",
      "hello",
      "in",
      "node1",
    ]);
    assert.deepEqual(parser.parse("create line a 0 0 1 1 in")?.args, [
      "line",
      "a",
      "0",
      "0",
      "1",
      "1",
      "in",
    ]);
  });

  it("reports an unclosed quote and does not return a command", () => {
    assert.throws(
      () => parser.parse('create text t 10 20 "hello'),
      (error: unknown) => {
        assert.ok(error instanceof LineSyntaxError);
        assert.equal(error.message, "unclosed quote");
        return true;
      },
    );
  });
});
