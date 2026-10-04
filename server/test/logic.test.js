import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, extractMessage } from "../brain.js";
import { parseTestOutput, describeTool } from "../agent.js";

test("@Pager mentions become asks", () => {
  assert.deepEqual(parseCommand("@Pager make the button orange"), { kind: "ask", arg: "make the button orange" });
  assert.deepEqual(parseCommand("@pager, fix tests"), { kind: "ask", arg: "fix tests" });
  assert.deepEqual(parseCommand("<@uid:pager-agent> hi"), { kind: "ask", arg: "hi" });
});

test("slash commands parse", () => {
  assert.deepEqual(parseCommand("/ship"), { kind: "ship", arg: "" });
  assert.deepEqual(parseCommand("/undo now"), { kind: "undo", arg: "now" });
});

test("plain chatter is ignored", () => {
  assert.equal(parseCommand("nice work team"), null);
  assert.equal(parseCommand(""), null);
  assert.equal(parseCommand("email me @pagerduty later"), null);
});

test("bare mention asks for help", () => {
  assert.deepEqual(parseCommand("@Pager"), { kind: "help", arg: "" });
});

test("node:test spec output is parsed", () => {
  const r = parseTestOutput("✔ a (1ms)\n✖ rejects bad email (2.1ms)\nℹ pass 6\nℹ fail 1\n", false, 10);
  assert.equal(r.passed, 6);
  assert.equal(r.failed, 1);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failures, ["rejects bad email"]);
});

test("TAP output is parsed", () => {
  const r = parseTestOutput("not ok 3 - signup needs a name\n# pass 6\n# fail 1\n", false, 10);
  assert.deepEqual([r.passed, r.failed, r.failures[0]], [6, 1, "signup needs a name"]);
});

test("tool calls become readable steps", () => {
  assert.equal(describeTool("Edit", { file_path: "styles.css" }).text, "Editing styles.css");
  assert.equal(describeTool("Bash", { command: "npm test" }).text, "Running npm test");
  assert.equal(describeTool("Grep", { pattern: "signup" }).icon, "search");
});

test("callback payloads are unwrapped", () => {
  const msg = { id: "9", sender: "hridya", receiver: "ship-it", data: { text: "@Pager hi" } };
  assert.equal(extractMessage({ data: { message: msg } }), msg);
  assert.equal(extractMessage(msg), msg);
  assert.equal(extractMessage({ trigger: "x" }), null);
});
