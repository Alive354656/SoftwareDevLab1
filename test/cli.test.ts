import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { HelpText } from "../src/command/HelpText";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("cli", () => {
  it("prints the banner and answers the shell script", { timeout: 20000 }, async () => {
    const child = spawn("npm", ["run", "cli"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.stdin.write(
      ["help", "# comment", "", "move c1 30 0", "exit", 'create text t 10 20 "oops', ""].join(
        "\n",
      ),
    );
    child.stdin.end();
    const [code] = (await once(child, "close")) as [number | null];
    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");

    assert.equal(code, 0, stderr);
    assert.match(stdout, /svg-editor 0\.1 — type 'help' for commands\n\n/);
    assert.match(stdout, /svg> \ninit \[w\] \[h\]/);
    assert.equal(stdout.includes("svg> svg>"), false);
    assert.ok(stdout.includes(HelpText.body), stdout);
    assert.ok(stdout.includes("error: no document. use 'init' or 'read' first"));
    assert.ok(stdout.includes("error: unknown command: exit"));
    assert.ok(stdout.includes("error: unclosed quote"));
    assert.equal(stdout.includes("# comment"), false);
    assert.equal(stderr.includes("error:"), false, stderr);
  });
});
