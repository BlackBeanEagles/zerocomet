// Runs Claude Code headless inside WORKSPACE_DIR and reports what it is doing.
import { spawn, execFile, exec as execShell } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "./config.js";

const exec = promisify(execFile);
const execCmd = promisify(execShell);
const MAX_PATCH = 4200; // CometChat customData is capped at 10 KB; leave room for the rest of the card

// The workspace keeps its history in .pager-git so it never nests inside the Agent Pager repo.
const git = (...args) =>
  exec("git", [`--git-dir=${path.join(config.workspace, ".pager-git")}`, `--work-tree=${config.workspace}`, ...args], {
    cwd: config.workspace,
    maxBuffer: 8 << 20,
  }).then((r) => r.stdout);

// Turns a stream-json tool_use block into a short human step for the chat.
export function describeTool(name, input = {}) {
  const file = input.file_path || input.path || input.notebook_path;
  const short = file ? path.relative(config.workspace, path.resolve(config.workspace, file)).replaceAll("\\", "/") : "";
  switch (name) {
    case "Read":
      return { icon: "read", text: `Reading ${short}` };
    case "Edit":
    case "MultiEdit":
      return { icon: "edit", text: `Editing ${short}` };
    case "Write":
      return { icon: "edit", text: `Writing ${short}` };
    case "Glob":
    case "Grep":
      return { icon: "search", text: `Searching ${input.pattern ? `“${String(input.pattern).slice(0, 40)}”` : "the code"}` };
    case "Bash":
      return { icon: "run", text: `Running ${String(input.command || "").slice(0, 60)}` };
    case "TodoWrite":
      return { icon: "plan", text: "Planning the change" };
    default:
      return { icon: "tool", text: name };
  }
}

let sessionId = null; // the agent keeps context across messages in the group

export function resetSession() {
  sessionId = null;
}

function runClaude(prompt, onStep) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "acceptEdits",
      "--allowedTools", "Read", "Edit", "MultiEdit", "Write", "Glob", "Grep", "TodoWrite", "Bash(npm test*)", "Bash(node --test*)",
      "--disallowedTools", "Bash(git push*)", "Bash(rm *)", "WebFetch", "WebSearch",
      "--append-system-prompt",
      "You are Pager, a coding agent that teammates message from a group chat on their phones. " +
        "Work only inside the current directory. Keep changes small and focused. " +
        "When done, reply in at most 2 short sentences describing what you changed. Do not commit.",
    ];
    if (sessionId) args.push("--resume", sessionId);

    const child = spawn(config.claudeBin, args, { cwd: config.workspace, windowsHide: true });
    let buf = "";
    let result = null;
    let lastText = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === "system" && ev.session_id) sessionId = ev.session_id;
        if (ev.type === "assistant") {
          for (const block of ev.message?.content || []) {
            if (block.type === "tool_use") onStep(describeTool(block.name, block.input));
            if (block.type === "text" && block.text.trim()) lastText = block.text.trim();
          }
        }
        if (ev.type === "result") {
          result = ev;
          if (ev.session_id) sessionId = ev.session_id;
        }
      }
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (!result && code !== 0) return reject(new Error(stderr.trim().slice(-400) || `claude exited ${code}`));
      resolve({
        summary: (result?.result || lastText || "Done.").trim(),
        costUsd: result?.total_cost_usd ?? null,
        turns: result?.num_turns ?? null,
        isError: Boolean(result?.is_error),
      });
    });
    child.stdin.end(prompt);
  });
}

async function mockClaude(prompt, onStep) {
  const steps = [
    { icon: "plan", text: "Planning the change" },
    { icon: "search", text: "Searching “signup”" },
    { icon: "read", text: "Reading index.html" },
    { icon: "edit", text: "Editing styles.css" },
    { icon: "run", text: "Running npm test" },
  ];
  for (const s of steps) {
    onStep(s);
    await new Promise((r) => setTimeout(r, 700));
  }
  return { summary: `(mock) I would have done: ${prompt.slice(0, 80)}`, costUsd: 0, turns: steps.length, isError: false };
}

export async function collectDiff() {
  await git("add", "-N", ".").catch(() => {});
  const numstat = await git("diff", "--numstat").catch(() => "");
  const files = numstat
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [add, del, file] = l.split("\t");
      return { file, add: Number(add) || 0, del: Number(del) || 0 };
    });
  let patch = await git("diff", "--unified=2", "--no-color").catch(() => "");
  const truncated = patch.length > MAX_PATCH;
  if (truncated) patch = patch.slice(0, MAX_PATCH);
  return { files, patch, truncated };
}

export async function runTests() {
  const started = Date.now();
  try {
    const { stdout, stderr } = await execCmd("npm test --silent", {
      cwd: config.workspace,
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 4 << 20,
    });
    return parseTestOutput(stdout + stderr, true, Date.now() - started);
  } catch (e) {
    return parseTestOutput(`${e.stdout || ""}${e.stderr || ""}`, false, Date.now() - started);
  }
}

export function parseTestOutput(out, ok, ms) {
  const num = (re) => Number(out.match(re)?.[1] ?? NaN);
  // node:test prints "ℹ pass 7" (spec reporter) or "# pass 7" (TAP)
  let passed = num(/^(?:#|ℹ) pass (\d+)/m);
  let failed = num(/^(?:#|ℹ) fail (\d+)/m);
  if (Number.isNaN(passed)) passed = num(/(\d+) passing/);
  if (Number.isNaN(failed)) failed = num(/(\d+) failing/);
  passed = Number.isNaN(passed) ? null : passed;
  failed = Number.isNaN(failed) ? (ok ? 0 : null) : failed;
  const failures = [...out.matchAll(/^(?:not ok \d+ - |✖ )(.+?)(?: \([\d.]+ms\))?$/gm)]
    .map((m) => m[1])
    .filter((f) => !/^failing tests:?$/i.test(f))
    .slice(0, 3);
  return { ok: ok && !failed, passed, failed, failures, ms };
}

export async function runAgent(prompt, onStep) {
  const started = Date.now();
  const res = config.mockAgent ? await mockClaude(prompt, onStep) : await runClaude(prompt, onStep);
  onStep({ icon: "run", text: "Running the test suite" });
  const [diff, tests] = await Promise.all([collectDiff(), runTests()]);
  return { ...res, diff, tests, ms: Date.now() - started };
}

export async function commit(message) {
  const { files } = await collectDiff();
  if (!files.length) return null;
  await git("add", "-A");
  await git("-c", "user.name=Pager (agent)", "-c", "user.email=pager@agent.local", "commit", "-q", "-m", message);
  const sha = (await git("rev-parse", "--short", "HEAD")).trim();
  return { sha, files: files.length };
}

export async function undo() {
  await git("checkout", "--", ".").catch(() => {});
  await git("clean", "-fdq").catch(() => {});
}

export async function lastCommits(n = 3) {
  const out = await git("log", `-${n}`, "--pretty=%h\t%s\t%cr").catch(() => "");
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, subject, when] = l.split("\t");
      return { sha, subject, when };
    });
}
