# Obsidian Taskboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Obsidian plugin that renders a kanban board over markdown `- [ ]` tasks discovered across the vault, where dragging a card rewrites the source task line in place.

**Architecture:** Five units with one job each — Settings (config), TaskParser (pure parse/serialize), TaskIndex (in-memory index + vault events), TaskMutator (the only disk writer), BoardView (Preact UI in an Obsidian ItemView). File is the source of truth; the plugin writes the file then re-renders from the index. Status is derived per-board from a task's tags and the board's column definitions.

**Tech Stack:** TypeScript (strict), esbuild, Preact (via `preact/compat`), `@hello-pangea/dnd`, vitest, Obsidian plugin API.

**Spec:** `docs/superpowers/specs/2026-06-05-obsidian-taskboard-design.md`

---

## File Structure

```
obsidian-taskboard/
  manifest.json                 # Obsidian plugin metadata
  package.json                  # deps + scripts
  tsconfig.json                 # strict TS, preact JSX
  esbuild.config.mjs            # bundle to main.js
  vitest.config.ts              # test runner config
  src/
    main.ts                     # Plugin class: lifecycle, command/view registration
    settings.ts                 # Settings interface, DEFAULT_SETTINGS, SettingsTab
    types.ts                    # Task, Column, BoardConfig, IndexEvent, Priority
    parser/
      parseLine.ts              # parseLine(text) -> Task | null
      serializeTask.ts          # serializeTask(task) -> string
      taskId.ts                 # stable id hash(filePath + body)
      parser.test.ts            # parse, serialize, round-trip, interop fixtures
    index/
      TaskIndex.ts              # in-memory index + vault event wiring + emitter
      index.test.ts             # index mutations + event diffs
    mutator/
      TaskMutator.ts            # setStatus/setDueDate/setPriority/setText/createTask
      mutator.test.ts           # tag logic, done transition, interop round-trip
    view/
      BoardView.tsx             # ItemView shell, mounts Preact root
      Board.tsx                 # Preact root: columns from board config + index
      Column.tsx                # one column: header, card list, + Add, droppable
      Card.tsx                  # one card: body, due/priority chips, source link
      deriveColumns.ts          # pure: (tasks, BoardConfig) -> {column -> Task[]} + sort
      boardConfig.ts            # parse board frontmatter
      hooks.ts                  # useTaskIndex subscription hook
    util/
      excludes.ts               # apply Settings exclusion rules (files + tasks)
      dailyNote.ts              # resolve/create today's daily note path
```

Vitest covers `parser/`, `index/`, `mutator/`, `view/deriveColumns.ts`, `view/boardConfig.ts`, `util/excludes.ts`, `util/dailyNote.ts`. `BoardView`, Preact components, and `main.ts` wiring are smoke-tested manually in Obsidian.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `manifest.json`
- Create: `esbuild.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `versions.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "obsidian-taskboard",
  "version": "0.1.0",
  "description": "Kanban board sourced from markdown - [ ] tasks across your vault.",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["obsidian", "kanban", "tasks"],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.11.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.20.0",
    "obsidian": "^1.5.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  },
  "dependencies": {
    "preact": "^10.20.0",
    "@hello-pangea/dnd": "^16.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "allowJs": true,
    "noImplicitAny": true,
    "strict": true,
    "strictNullChecks": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["DOM", "ES2020"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "paths": {
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"],
      "react/jsx-runtime": ["./node_modules/preact/jsx-runtime"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "id": "obsidian-taskboard",
  "name": "Taskboard",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "Kanban board sourced from markdown - [ ] tasks across your vault.",
  "author": "mwdavisii",
  "isDesktopOnly": false
}
```

- [ ] **Step 4: Create `versions.json`**

```json
{
  "0.1.0": "1.5.0"
}
```

- [ ] **Step 5: Create `esbuild.config.mjs`**

```js
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  jsx: "automatic",
  jsxImportSource: "preact",
  alias: {
    react: "preact/compat",
    "react-dom": "preact/compat",
  },
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
main.js
*.js.map
.DS_Store
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` populated; `preact`, `@hello-pangea/dnd`, `obsidian`, `vitest` present.

- [ ] **Step 9: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: vitest reports "No test files found" (exit code may be non-zero — that's fine for now; the next task adds tests).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json manifest.json versions.json esbuild.config.mjs vitest.config.ts .gitignore
git commit -m "chore: scaffold obsidian-taskboard plugin project"
```

---

## Task 2: Core types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type Priority =
  | "highest"
  | "high"
  | "medium"
  | "low"
  | "lowest"
  | null;

/** A single markdown task line, parsed. Has no `status` — status is derived per-board. */
export interface Task {
  /** Stable id: hash(filePath + body). Survives edits to surrounding lines. */
  id: string;
  /** Vault-relative path of the source file. */
  filePath: string;
  /** 0-based line number in the current file content. */
  lineNumber: number;
  /** Verbatim source line at parse time (round-trip safety). */
  rawLine: string;
  /** [x] vs [ ]. */
  checked: boolean;
  /** Task text with recognized metadata stripped. */
  body: string;
  /** ISO YYYY-MM-DD from due-date emoji, or null. */
  dueDate: string | null;
  /** Parsed from priority emoji, or null. */
  priority: Priority;
  /** All #tags on the line (no status/non-status distinction at parse time). */
  tags: string[];
  /** Unrecognized trailing metadata preserved verbatim for round-trip. */
  trailing: string;
}

/** One board column. `tag: null` is the catch-all (Backlog) for tasks with no matching status tag. */
export interface Column {
  name: string;
  tag: string | null;
}

/** Board configuration parsed from a board note's frontmatter. */
export interface BoardConfig {
  columns: Column[];
  /** "daily_note" or a vault-relative path. */
  newTaskDestination: string;
}

export type IndexEvent =
  | { type: "task-added"; task: Task }
  | { type: "task-removed"; taskId: string }
  | { type: "task-changed"; before: Task; after: Task }
  | { type: "bulk-changed"; filePath: string };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core Task/Column/BoardConfig types"
```

---

## Task 3: Stable task id

**Files:**
- Create: `src/parser/taskId.ts`
- Test: `src/parser/parser.test.ts` (created here, extended later)

- [ ] **Step 1: Write the failing test**

Create `src/parser/parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeTaskId } from "./taskId";

describe("computeTaskId", () => {
  it("is stable for the same file + body", () => {
    const a = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    const b = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    expect(a).toBe(b);
  });

  it("differs when body differs", () => {
    const a = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    const b = computeTaskId("Daily/2026-06-05.md", "Reply to client");
    expect(a).not.toBe(b);
  });

  it("differs when file differs", () => {
    const a = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    const b = computeTaskId("Daily/2026-06-06.md", "Reply to vendor");
    expect(a).not.toBe(b);
  });

  it("returns a hex string", () => {
    const id = computeTaskId("a.md", "x");
    expect(id).toMatch(/^[0-9a-f]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: FAIL — cannot resolve `./taskId`.

- [ ] **Step 3: Write minimal implementation**

Create `src/parser/taskId.ts`:

```ts
/**
 * Stable id for a task: a hash of filePath + body.
 * Independent of line number so the id survives edits to surrounding lines.
 * Uses a simple FNV-1a 32-bit hash — no crypto dependency needed.
 */
export function computeTaskId(filePath: string, body: string): string {
  const input = filePath + " " + body;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 forces unsigned 32-bit before hex.
  return (hash >>> 0).toString(16).padStart(8, "0");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/parser/taskId.ts src/parser/parser.test.ts
git commit -m "feat: add stable task id hash"
```

---

## Task 4: parseLine

**Files:**
- Create: `src/parser/parseLine.ts`
- Test: `src/parser/parser.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `src/parser/parser.test.ts`:

```ts
import { parseLine } from "./parseLine";

describe("parseLine", () => {
  const F = "Daily/2026-06-05.md";

  it("returns null for non-task lines", () => {
    expect(parseLine("Just a paragraph", F, 0)).toBeNull();
    expect(parseLine("- a bullet, no checkbox", F, 0)).toBeNull();
    expect(parseLine("1. numbered", F, 0)).toBeNull();
  });

  it("parses an unchecked task", () => {
    const t = parseLine("- [ ] Reply to vendor", F, 3)!;
    expect(t).not.toBeNull();
    expect(t.checked).toBe(false);
    expect(t.body).toBe("Reply to vendor");
    expect(t.lineNumber).toBe(3);
    expect(t.filePath).toBe(F);
    expect(t.tags).toEqual([]);
    expect(t.dueDate).toBeNull();
    expect(t.priority).toBeNull();
  });

  it("parses a checked task", () => {
    const t = parseLine("- [x] Done thing", F, 0)!;
    expect(t.checked).toBe(true);
    expect(t.body).toBe("Done thing");
  });

  it("treats [X] uppercase as checked", () => {
    expect(parseLine("- [X] Yep", F, 0)!.checked).toBe(true);
  });

  it("extracts a due date", () => {
    const t = parseLine("- [ ] Pay invoice 📅 2026-06-30", F, 0)!;
    expect(t.dueDate).toBe("2026-06-30");
    expect(t.body).toBe("Pay invoice");
  });

  it("extracts priority", () => {
    expect(parseLine("- [ ] Big task ⏫", F, 0)!.priority).toBe("high");
    expect(parseLine("- [ ] Huge 🔺", F, 0)!.priority).toBe("highest");
    expect(parseLine("- [ ] Small 🔽", F, 0)!.priority).toBe("low");
    expect(parseLine("- [ ] Tiny ⏬", F, 0)!.priority).toBe("lowest");
    expect(parseLine("- [ ] Med 🔼", F, 0)!.priority).toBe("medium");
  });

  it("extracts tags", () => {
    const t = parseLine("- [ ] Triage #todo #project/epic", F, 0)!;
    expect(t.tags).toEqual(["#todo", "#project/epic"]);
    expect(t.body).toBe("Triage");
  });

  it("does NOT treat a url fragment as a tag", () => {
    const t = parseLine("- [ ] See https://example.com/page#section now", F, 0)!;
    expect(t.tags).toEqual([]);
    expect(t.body).toBe("See https://example.com/page#section now");
  });

  it("preserves an outlook open-link inside body", () => {
    const line =
      "- [ ] Reply [(open)](https://outlook.office365.com/owa/?ItemID=AAA%3D&exvsurl=1)";
    const t = parseLine(line, F, 0)!;
    expect(t.body).toContain("[(open)](https://outlook.office365.com/owa/?ItemID=AAA%3D&exvsurl=1)");
    expect(t.tags).toEqual([]);
  });

  it("preserves indentation", () => {
    const t = parseLine("    - [ ] Nested", F, 0)!;
    expect(t.rawLine).toBe("    - [ ] Nested");
    expect(t.body).toBe("Nested");
  });

  it("preserves an html comment (in body until trailing split lands in Task 5)", () => {
    const t = parseLine("- [ ] Reply <!-- mid:ABC123= -->", F, 0)!;
    expect(t.body).toContain("<!-- mid:ABC123= -->");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: FAIL — cannot resolve `./parseLine`.

- [ ] **Step 3: Write minimal implementation**

Create `src/parser/parseLine.ts`:

```ts
import { Task, Priority } from "../types";
import { computeTaskId } from "./taskId";

const TASK_RE = /^(\s*)- \[([ xX/\-])\]\s+(.*)$/;
const DUE_RE = /📅\s+(\d{4}-\d{2}-\d{2})/;
// Whitespace (or start) required before # so URL fragments aren't matched as tags.
const TAG_RE = /(?:^|\s)(#[\w\-/]+)/g;

const PRIORITY_MAP: Record<string, Priority> = {
  "🔺": "highest",
  "⏫": "high",
  "🔼": "medium",
  "🔽": "low",
  "⏬": "lowest",
};

/**
 * Parse a single markdown line into a Task, or null if it is not a `- [ ]` task.
 * Recognized metadata (due date, priority, tags) is stripped from `body`.
 * Anything else — including HTML comments and markdown links — is preserved
 * verbatim (in `body` or, after Task 5, `trailing`) so the line round-trips.
 */
export function parseLine(
  line: string,
  filePath: string,
  lineNumber: number
): Task | null {
  const m = TASK_RE.exec(line);
  if (!m) return null;

  const [, , stateChar, rawBody] = m;
  const checked = stateChar === "x" || stateChar === "X";

  let work = rawBody;

  // Due date.
  let dueDate: string | null = null;
  const dm = DUE_RE.exec(work);
  if (dm) {
    dueDate = dm[1];
    work = work.replace(DUE_RE, " ");
  }

  // Priority.
  let priority: Priority = null;
  for (const glyph of Object.keys(PRIORITY_MAP)) {
    if (work.includes(glyph)) {
      priority = PRIORITY_MAP[glyph];
      work = work.split(glyph).join(" ");
      break;
    }
  }

  // Tags (whitespace-prefixed).
  const tags: string[] = [];
  work = work.replace(TAG_RE, (_full, tag) => {
    tags.push(tag);
    return " ";
  });

  const body = work.replace(/\s+/g, " ").trim();

  return {
    id: computeTaskId(filePath, body),
    filePath,
    lineNumber,
    rawLine: line,
    checked,
    body,
    dueDate,
    priority,
    tags,
    trailing: "",
  };
}
```

Note: in this minimal pass, HTML comments remain part of `body`. The dedicated `trailing` split is added in Task 5 alongside serialize, so round-trip can be verified end-to-end.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: PASS (all parseLine + taskId tests).

- [ ] **Step 5: Commit**

```bash
git add src/parser/parseLine.ts src/parser/parser.test.ts
git commit -m "feat: add parseLine for markdown task lines"
```

---

## Task 5: serializeTask + trailing split + round-trip

**Files:**
- Create: `src/parser/serializeTask.ts`
- Modify: `src/parser/parseLine.ts` (split HTML comments into `trailing`)
- Test: `src/parser/parser.test.ts` (extend)

- [ ] **Step 1: Replace the temporary html-comment test from Task 4**

In `src/parser/parser.test.ts`, DELETE this test (added in Task 4):

```ts
  it("preserves an html comment (in body until trailing split lands in Task 5)", () => {
    const t = parseLine("- [ ] Reply <!-- mid:ABC123= -->", F, 0)!;
    expect(t.body).toContain("<!-- mid:ABC123= -->");
  });
```

- [ ] **Step 2: Write the failing tests**

Append to `src/parser/parser.test.ts`:

```ts
import { serializeTask } from "./serializeTask";

describe("serializeTask", () => {
  const F = "Daily/2026-06-05.md";

  it("serializes a plain unchecked task", () => {
    const t = parseLine("- [ ] Reply to vendor", F, 0)!;
    expect(serializeTask(t)).toBe("- [ ] Reply to vendor");
  });

  it("serializes due date and priority in fixed order", () => {
    const t = parseLine("- [ ] Pay ⏫ 📅 2026-06-30", F, 0)!;
    // Fixed order: body, due, priority, tags, trailing.
    expect(serializeTask(t)).toBe("- [ ] Pay 📅 2026-06-30 ⏫");
  });

  it("emits tags after metadata", () => {
    const t = parseLine("- [ ] Triage #todo", F, 0)!;
    expect(serializeTask(t)).toBe("- [ ] Triage #todo");
  });

  it("preserves indentation on serialize", () => {
    const t = parseLine("    - [ ] Nested", F, 0)!;
    expect(serializeTask(t)).toBe("    - [ ] Nested");
  });
});

describe("html comment goes to trailing", () => {
  const F = "Daily/2026-06-05.md";
  it("splits an html comment out of body into trailing", () => {
    const t = parseLine("- [ ] Reply <!-- mid:ABC123= -->", F, 0)!;
    expect(t.body).toBe("Reply");
    expect(t.trailing).toBe("<!-- mid:ABC123= -->");
  });
});

describe("round-trip", () => {
  const F = "Daily/2026-06-05.md";

  const lines = [
    "- [ ] Reply to vendor",
    "- [x] Done thing",
    "- [ ] Pay invoice 📅 2026-06-30",
    "- [ ] Big task ⏫",
    "- [ ] Triage #todo #project/epic",
    "    - [ ] Nested task",
    "- [ ] Reply <!-- mid:ABC123= -->",
  ];

  for (const line of lines) {
    it(`round-trips: ${line}`, () => {
      const once = parseLine(line, F, 0)!;
      const out = serializeTask(once);
      const twice = parseLine(out, F, 0)!;
      // Semantic equality (ignore lineNumber/rawLine/id which depend on input text).
      expect({
        checked: twice.checked,
        body: twice.body,
        dueDate: twice.dueDate,
        priority: twice.priority,
        tags: twice.tags,
        trailing: twice.trailing,
      }).toEqual({
        checked: once.checked,
        body: once.body,
        dueDate: once.dueDate,
        priority: once.priority,
        tags: once.tags,
        trailing: once.trailing,
      });
    });
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: FAIL — cannot resolve `./serializeTask`, and the trailing-split test fails.

- [ ] **Step 4: Add trailing split to `parseLine.ts`**

In `src/parser/parseLine.ts`, add an HTML-comment extractor. Insert this block AFTER the priority block and BEFORE the tags block:

```ts
  // HTML comments (e.g. the cleanup pipeline's mid markers) → trailing.
  let trailing = "";
  const COMMENT_RE = /<!--.*?-->/g;
  const comments = work.match(COMMENT_RE);
  if (comments) {
    trailing = comments.join(" ");
    work = work.replace(COMMENT_RE, " ");
  }
```

Then change the return object's `trailing: ""` to `trailing,`.

- [ ] **Step 5: Write `serializeTask.ts`**

Create `src/parser/serializeTask.ts`:

```ts
import { Task, Priority } from "../types";

const PRIORITY_GLYPH: Record<Exclude<Priority, null>, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

/**
 * Serialize a Task back to a markdown line. Fixed field order so round-trip
 * is stable: indent, checkbox, body, due, priority, tags, trailing.
 * Null/empty fields are omitted (no double spaces).
 */
export function serializeTask(task: Task): string {
  const indentMatch = /^(\s*)/.exec(task.rawLine);
  const indent = indentMatch ? indentMatch[1] : "";
  const box = task.checked ? "x" : " ";

  const parts: string[] = [task.body];
  if (task.dueDate) parts.push(`📅 ${task.dueDate}`);
  if (task.priority) parts.push(PRIORITY_GLYPH[task.priority]);
  for (const tag of task.tags) parts.push(tag);
  if (task.trailing) parts.push(task.trailing);

  const rest = parts.filter((p) => p.length > 0).join(" ");
  return `${indent}- [${box}] ${rest}`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: PASS (all serialize + round-trip + trailing tests).

- [ ] **Step 7: Commit**

```bash
git add src/parser/serializeTask.ts src/parser/parseLine.ts src/parser/parser.test.ts
git commit -m "feat: add serializeTask, html-comment trailing split, round-trip tests"
```

---

## Task 6: Cleanup-pipeline interop fixtures

**Files:**
- Test: `src/parser/parser.test.ts` (extend)

These tests lock the interop contract with `~/code/productivity/config/scripts/cleanup.sh`.

- [ ] **Step 1: Write the tests**

Append to `src/parser/parser.test.ts`:

```ts
describe("cleanup.sh interop", () => {
  const F = "00_DailyNotes/2026/06/06-05-2026.md";

  const MID =
    "AAMkADA5YTJiZmRhLWU5YTgtNDQ1Yi05ZGRiLTc0ZjU1MTA4NzcxMwBGAAAAAAH5KJT5AAA=";
  const URL =
    "https://outlook.office365.com/owa/?ItemID=AAMkADA5YTJiZmRhAAH5KJT5AAA%3D&exvsurl=1&viewmodel=ReadMessageItem";

  // The two regexes cleanup.sh uses (Task 4 of cleanup.sh).
  const MID_RE = /- \[x\].*<!-- mid:(\S+) -->/;
  const LINK_RE =
    /- \[x\].*\(https:\/\/outlook\.office365\.com\/owa\/\?ItemID=([^&]+)&/;

  it("a checked task with a mid comment matches cleanup's MID regex", () => {
    const line = `- [ ] Reply to Katie [(open)](${URL}) <!-- mid:${MID} -->`;
    const t = parseLine(line, F, 0)!;
    const done = { ...t, checked: true, tags: ["#done"] };
    const out = serializeTask(done);
    expect(MID_RE.test(out)).toBe(true);
    expect(MID_RE.exec(out)![1]).toBe(MID);
  });

  it("a legacy link-only checked task matches cleanup's LINK regex", () => {
    const line = `- [ ] Reply to AWS [(open)](${URL})`;
    const t = parseLine(line, F, 0)!;
    const done = { ...t, checked: true, tags: ["#done"] };
    const out = serializeTask(done);
    expect(LINK_RE.test(out)).toBe(true);
  });

  it("does not corrupt the outlook url query string", () => {
    const line = `- [ ] Reply [(open)](${URL}) <!-- mid:${MID} -->`;
    const t = parseLine(line, F, 0)!;
    const out = serializeTask({ ...t, checked: true, tags: ["#done"] });
    expect(out).toContain("ItemID=");
    expect(out).toContain("&exvsurl=1");
    expect(out).toContain(`<!-- mid:${MID} -->`);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/parser/parser.test.ts`
Expected: PASS. If any fail, the parser/serializer is corrupting interop content — fix the parser/serializer, do NOT relax the assertions.

- [ ] **Step 3: Commit**

```bash
git add src/parser/parser.test.ts
git commit -m "test: lock cleanup.sh interop contract with fixtures"
```

---

## Task 7: Exclusion rules

**Files:**
- Create: `src/util/excludes.ts`
- Test: `src/util/excludes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/util/excludes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isFileExcluded, isTaskExcluded } from "./excludes";

const settings = {
  excludeFolders: ["Templates", "Archive/**"],
  excludeFiles: ["00_DailyNotes/secret.md"],
  excludeTags: ["#archived", "#private"],
};

describe("isFileExcluded", () => {
  it("excludes a file directly under an excluded folder", () => {
    expect(isFileExcluded("Templates/daily.md", settings)).toBe(true);
  });

  it("excludes a file nested under a globbed folder", () => {
    expect(isFileExcluded("Archive/2025/jan.md", settings)).toBe(true);
  });

  it("excludes an exact file match", () => {
    expect(isFileExcluded("00_DailyNotes/secret.md", settings)).toBe(true);
  });

  it("does not exclude a normal file", () => {
    expect(isFileExcluded("00_DailyNotes/2026/06/06-05-2026.md", settings)).toBe(
      false
    );
  });
});

describe("isTaskExcluded", () => {
  it("excludes a task bearing an excluded tag", () => {
    expect(isTaskExcluded(["#todo", "#archived"], settings)).toBe(true);
  });

  it("keeps a task with no excluded tags", () => {
    expect(isTaskExcluded(["#todo"], settings)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/util/excludes.test.ts`
Expected: FAIL — cannot resolve `./excludes`.

- [ ] **Step 3: Write minimal implementation**

Create `src/util/excludes.ts`:

```ts
export interface ExclusionSettings {
  excludeFolders: string[];
  excludeFiles: string[];
  excludeTags: string[];
}

/** Convert a folder glob ("Archive/**" or "Templates") into a RegExp. */
function folderToRegExp(pattern: string): RegExp {
  // Normalize: strip trailing slash.
  const p = pattern.replace(/\/+$/, "");
  // Escape regex specials except our glob marker.
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // "**" matches any depth; a bare folder matches that folder and anything under it.
  const body = escaped.includes("**")
    ? escaped.replace(/\*\*/g, ".*")
    : `${escaped}(/.*)?`;
  return new RegExp(`^${body}$`);
}

export function isFileExcluded(
  filePath: string,
  settings: ExclusionSettings
): boolean {
  if (settings.excludeFiles.includes(filePath)) return true;
  return settings.excludeFolders.some((f) => folderToRegExp(f).test(filePath));
}

export function isTaskExcluded(
  tags: string[],
  settings: ExclusionSettings
): boolean {
  return tags.some((t) => settings.excludeTags.includes(t));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/util/excludes.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/util/excludes.ts src/util/excludes.test.ts
git commit -m "feat: add file/task exclusion rules"
```

---

## Task 8: Column derivation + sort

**Files:**
- Create: `src/view/deriveColumns.ts`
- Test: `src/view/deriveColumns.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/view/deriveColumns.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveColumns } from "./deriveColumns";
import { Task, Column } from "../types";

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    filePath: partial.filePath ?? "a.md",
    lineNumber: partial.lineNumber ?? 0,
    rawLine: partial.rawLine ?? "- [ ] x",
    checked: partial.checked ?? false,
    body: partial.body ?? "x",
    dueDate: partial.dueDate ?? null,
    priority: partial.priority ?? null,
    tags: partial.tags ?? [],
    trailing: partial.trailing ?? "",
  };
}

const columns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
  { name: "Doing", tag: "#doing" },
  { name: "Done", tag: "#done" },
];

describe("deriveColumns", () => {
  it("places a task in the column matching its status tag", () => {
    const tasks = [task({ tags: ["#doing"], body: "A" })];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Doing"].map((t) => t.body)).toEqual(["A"]);
  });

  it("places an untagged task in the null-tag (Backlog) column", () => {
    const tasks = [task({ tags: [], body: "A" })];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Backlog"].map((t) => t.body)).toEqual(["A"]);
  });

  it("uses the first matching column when a task has multiple status tags", () => {
    const tasks = [task({ tags: ["#done", "#todo"], body: "A" })];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Todo"].map((t) => t.body)).toEqual(["A"]);
  });

  it("sorts by due date (nulls last), then priority, then mtime", () => {
    const tasks = [
      task({ tags: ["#todo"], body: "no-due", dueDate: null }),
      task({ tags: ["#todo"], body: "later", dueDate: "2026-07-01" }),
      task({ tags: ["#todo"], body: "sooner", dueDate: "2026-06-10" }),
    ];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Todo"].map((t) => t.body)).toEqual(["sooner", "later", "no-due"]);
  });

  it("breaks due-date ties by priority (highest first)", () => {
    const tasks = [
      task({ tags: ["#todo"], body: "low", dueDate: "2026-06-10", priority: "low" }),
      task({ tags: ["#todo"], body: "high", dueDate: "2026-06-10", priority: "high" }),
    ];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Todo"].map((t) => t.body)).toEqual(["high", "low"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/view/deriveColumns.test.ts`
Expected: FAIL — cannot resolve `./deriveColumns`.

- [ ] **Step 3: Write minimal implementation**

Create `src/view/deriveColumns.ts`:

```ts
import { Task, Column, Priority } from "../types";

/** Map of filePath -> mtime (ms). Used as the final sort tiebreaker. */
export type MtimeMap = Record<string, number>;

const PRIORITY_RANK: Record<Exclude<Priority, null>, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

function priorityRank(p: Priority): number {
  return p === null ? 5 : PRIORITY_RANK[p];
}

function compareTasks(a: Task, b: Task, mtimes: MtimeMap): number {
  // Due date ascending, nulls last.
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  // Priority: highest first.
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;
  // Mtime: most recent first.
  const ma = mtimes[a.filePath] ?? 0;
  const mb = mtimes[b.filePath] ?? 0;
  return mb - ma;
}

/**
 * Group tasks into columns by status tag, then sort each column.
 * A task lands in the first column whose tag it carries; tasks with no
 * matching tag land in the column whose tag is null (Backlog).
 * Returns an object keyed by column name.
 */
export function deriveColumns(
  tasks: Task[],
  columns: Column[],
  mtimes: MtimeMap
): Record<string, Task[]> {
  const result: Record<string, Task[]> = {};
  for (const col of columns) result[col.name] = [];

  const nullColumn = columns.find((c) => c.tag === null);

  for (const t of tasks) {
    const match = columns.find((c) => c.tag !== null && t.tags.includes(c.tag));
    const target = match ?? nullColumn;
    if (target) result[target.name].push(t);
  }

  for (const col of columns) {
    result[col.name].sort((a, b) => compareTasks(a, b, mtimes));
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/view/deriveColumns.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/view/deriveColumns.ts src/view/deriveColumns.test.ts
git commit -m "feat: add column derivation and sort"
```

---

## Task 9: Board config (frontmatter)

**Files:**
- Create: `src/view/boardConfig.ts`
- Test: `src/view/boardConfig.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/view/boardConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseBoardConfig, isBoardFrontmatter } from "./boardConfig";
import { Column } from "../types";

const defaultColumns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
];

describe("isBoardFrontmatter", () => {
  it("is true when taskboard is true", () => {
    expect(isBoardFrontmatter({ taskboard: true })).toBe(true);
  });
  it("is false when absent or false", () => {
    expect(isBoardFrontmatter({})).toBe(false);
    expect(isBoardFrontmatter({ taskboard: false })).toBe(false);
    expect(isBoardFrontmatter(null)).toBe(false);
  });
});

describe("parseBoardConfig", () => {
  it("falls back to default columns when none specified", () => {
    const cfg = parseBoardConfig({ taskboard: true }, defaultColumns);
    expect(cfg.columns).toEqual(defaultColumns);
    expect(cfg.newTaskDestination).toBe("daily_note");
  });

  it("reads columns from frontmatter", () => {
    const cfg = parseBoardConfig(
      {
        taskboard: true,
        columns: [
          { name: "To Do", tag: "#todo" },
          { name: "Done", tag: "#done" },
        ],
      },
      defaultColumns
    );
    expect(cfg.columns).toEqual([
      { name: "To Do", tag: "#todo" },
      { name: "Done", tag: "#done" },
    ]);
  });

  it("normalizes a missing tag to null", () => {
    const cfg = parseBoardConfig(
      { taskboard: true, columns: [{ name: "Backlog" }] },
      defaultColumns
    );
    expect(cfg.columns[0]).toEqual({ name: "Backlog", tag: null });
  });

  it("reads new_task_destination", () => {
    const cfg = parseBoardConfig(
      { taskboard: true, new_task_destination: "Inbox.md" },
      defaultColumns
    );
    expect(cfg.newTaskDestination).toBe("Inbox.md");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/view/boardConfig.test.ts`
Expected: FAIL — cannot resolve `./boardConfig`.

- [ ] **Step 3: Write minimal implementation**

Create `src/view/boardConfig.ts`:

```ts
import { BoardConfig, Column } from "../types";

/** Frontmatter is whatever Obsidian's metadataCache hands us — an untyped record. */
type Frontmatter = Record<string, unknown> | null | undefined;

export function isBoardFrontmatter(fm: Frontmatter): boolean {
  return !!fm && fm["taskboard"] === true;
}

function normalizeColumn(raw: unknown): Column | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : null;
  if (!name) return null;
  const tag = typeof obj.tag === "string" ? obj.tag : null;
  return { name, tag };
}

export function parseBoardConfig(
  fm: Frontmatter,
  defaultColumns: Column[]
): BoardConfig {
  const rawColumns =
    fm && Array.isArray(fm["columns"]) ? (fm["columns"] as unknown[]) : [];
  const columns = rawColumns
    .map(normalizeColumn)
    .filter((c): c is Column => c !== null);

  const dest =
    fm && typeof fm["new_task_destination"] === "string"
      ? (fm["new_task_destination"] as string)
      : "daily_note";

  return {
    columns: columns.length > 0 ? columns : defaultColumns,
    newTaskDestination: dest,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/view/boardConfig.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/view/boardConfig.ts src/view/boardConfig.test.ts
git commit -m "feat: add board frontmatter config parsing"
```

---

## Task 10: TaskIndex

**Files:**
- Create: `src/index/TaskIndex.ts`
- Test: `src/index/index.test.ts`

TaskIndex is tested against a small fake of the parts of the Obsidian `Vault` it uses, so it can run under vitest without Obsidian.

- [ ] **Step 1: Write the failing tests**

Create `src/index/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TaskIndex } from "./TaskIndex";
import { IndexEvent } from "../types";

const settings = {
  excludeFolders: ["Templates"],
  excludeFiles: [],
  excludeTags: ["#archived"],
};

/** Minimal fake of the Vault surface TaskIndex consumes. */
function fakeVault(files: Record<string, string>) {
  return {
    files: { ...files },
    getMarkdownFiles() {
      return Object.keys(this.files).map((path) => ({ path }));
    },
    async read(file: { path: string }) {
      return this.files[file.path] ?? "";
    },
    async cachedRead(file: { path: string }) {
      return this.files[file.path] ?? "";
    },
  };
}

describe("TaskIndex.scan", () => {
  it("indexes tasks from non-excluded files", async () => {
    const vault = fakeVault({
      "a.md": "- [ ] Task A\n- [x] Task B",
      "Templates/t.md": "- [ ] Should be excluded",
    });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    const all = idx.allTasks();
    expect(all.map((t) => t.body).sort()).toEqual(["Task A", "Task B"]);
  });

  it("drops tasks bearing an excluded tag", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Keep\n- [ ] Drop #archived" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    expect(idx.allTasks().map((t) => t.body)).toEqual(["Keep"]);
  });
});

describe("TaskIndex.onModify", () => {
  it("re-parses a file and emits a bulk-changed event", async () => {
    const vault = fakeVault({ "a.md": "- [ ] One" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();

    const events: IndexEvent[] = [];
    idx.on((e) => events.push(e));

    vault.files["a.md"] = "- [ ] One\n- [ ] Two";
    await idx.onModify({ path: "a.md" } as any);

    expect(idx.allTasks().map((t) => t.body).sort()).toEqual(["One", "Two"]);
    expect(events.some((e) => e.type === "bulk-changed")).toBe(true);
  });
});

describe("TaskIndex.onDelete / onRename", () => {
  it("drops tasks for a deleted file", async () => {
    const vault = fakeVault({ "a.md": "- [ ] One", "b.md": "- [ ] Two" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    idx.onDelete({ path: "a.md" } as any);
    expect(idx.allTasks().map((t) => t.body)).toEqual(["Two"]);
  });

  it("moves tasks on rename", async () => {
    const vault = fakeVault({ "a.md": "- [ ] One" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    vault.files["b.md"] = vault.files["a.md"];
    delete vault.files["a.md"];
    await idx.onRename({ path: "b.md" } as any, "a.md");
    expect(idx.allTasks()[0].filePath).toBe("b.md");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/index/index.test.ts`
Expected: FAIL — cannot resolve `./TaskIndex`.

- [ ] **Step 3: Write minimal implementation**

Create `src/index/TaskIndex.ts`:

```ts
import { TFile, Vault } from "obsidian";
import { Task, IndexEvent } from "../types";
import { parseLine } from "../parser/parseLine";
import {
  isFileExcluded,
  isTaskExcluded,
  ExclusionSettings,
} from "../util/excludes";

type Listener = (event: IndexEvent) => void;

/**
 * In-memory index of all tasks in the vault. Owns parsing-on-read and
 * incremental updates from vault events. Does NOT write to disk.
 */
export class TaskIndex {
  private byId = new Map<string, Task>();
  private byFile = new Map<string, string[]>();
  private listeners: Listener[] = [];

  constructor(
    private vault: Vault,
    private settings: ExclusionSettings
  ) {}

  on(listener: Listener): void {
    this.listeners.push(listener);
  }

  private emit(event: IndexEvent): void {
    for (const l of this.listeners) l(event);
  }

  allTasks(): Task[] {
    return Array.from(this.byId.values());
  }

  /** Full scan of the vault. Called once on load. */
  async scan(): Promise<void> {
    this.byId.clear();
    this.byFile.clear();
    for (const file of this.vault.getMarkdownFiles()) {
      if (isFileExcluded(file.path, this.settings)) continue;
      const content = await this.vault.cachedRead(file as TFile);
      this.addFileTasks(file.path, content);
    }
  }

  /** Parse a file's content and insert its tasks (no events emitted). */
  private addFileTasks(filePath: string, content: string): void {
    const ids: string[] = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const task = parseLine(lines[i], filePath, i);
      if (!task) continue;
      if (isTaskExcluded(task.tags, this.settings)) continue;
      this.byId.set(task.id, task);
      ids.push(task.id);
    }
    this.byFile.set(filePath, ids);
  }

  /** Remove all tasks belonging to a file from the index. */
  private dropFile(filePath: string): void {
    const ids = this.byFile.get(filePath) ?? [];
    for (const id of ids) this.byId.delete(id);
    this.byFile.delete(filePath);
  }

  async onModify(file: TFile): Promise<void> {
    this.dropFile(file.path);
    if (!isFileExcluded(file.path, this.settings)) {
      const content = await this.vault.cachedRead(file);
      this.addFileTasks(file.path, content);
    }
    this.emit({ type: "bulk-changed", filePath: file.path });
  }

  async onCreate(file: TFile): Promise<void> {
    if (!file.path.endsWith(".md")) return;
    if (isFileExcluded(file.path, this.settings)) return;
    const content = await this.vault.cachedRead(file);
    this.addFileTasks(file.path, content);
    this.emit({ type: "bulk-changed", filePath: file.path });
  }

  onDelete(file: TFile): void {
    this.dropFile(file.path);
    this.emit({ type: "bulk-changed", filePath: file.path });
  }

  async onRename(file: TFile, oldPath: string): Promise<void> {
    this.dropFile(oldPath);
    if (!isFileExcluded(file.path, this.settings)) {
      const content = await this.vault.cachedRead(file);
      this.addFileTasks(file.path, content);
    }
    this.emit({ type: "bulk-changed", filePath: file.path });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/index/index.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/index/TaskIndex.ts src/index/index.test.ts
git commit -m "feat: add TaskIndex with scan and incremental updates"
```

---

## Task 11: TaskMutator

**Files:**
- Create: `src/mutator/TaskMutator.ts`
- Test: `src/mutator/mutator.test.ts`

TaskMutator writes via `vault.process(file, fn)`. The test uses a fake vault implementing `process` over an in-memory string.

- [ ] **Step 1: Write the failing tests**

Create `src/mutator/mutator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TaskMutator } from "./TaskMutator";
import { Column, Task } from "../types";
import { parseLine } from "../parser/parseLine";

const columns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
  { name: "Doing", tag: "#doing" },
  { name: "Done", tag: "#done" },
];

function fakeVault(files: Record<string, string>) {
  return {
    files: { ...files },
    getAbstractFileByPath(path: string) {
      return path in this.files ? { path } : null;
    },
    async process(file: { path: string }, fn: (data: string) => string) {
      const next = fn(this.files[file.path]);
      this.files[file.path] = next;
      return next;
    },
    async read(file: { path: string }) {
      return this.files[file.path];
    },
  };
}

function firstTask(content: string, path: string): Task {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = parseLine(lines[i], path, i);
    if (t) return t;
  }
  throw new Error("no task found");
}

describe("TaskMutator.setStatus", () => {
  it("adds a status tag when moving to a tagged column", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[1]); // Todo
    expect(vault.files["a.md"]).toBe("- [ ] Triage #todo");
  });

  it("swaps one status tag for another", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage #todo" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[2]); // Doing
    expect(vault.files["a.md"]).toBe("- [ ] Triage #doing");
  });

  it("removes all board status tags when moving to Backlog (null tag)", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage #doing" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[0]); // Backlog
    expect(vault.files["a.md"]).toBe("- [ ] Triage");
  });

  it("checks the box when moving to Done and checkBoxOnDone is true", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[3]); // Done
    expect(vault.files["a.md"]).toBe("- [x] Triage #done");
  });

  it("unchecks the box when moving out of Done", async () => {
    const vault = fakeVault({ "a.md": "- [x] Triage #done" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[2]); // Doing
    expect(vault.files["a.md"]).toBe("- [ ] Triage #doing");
  });

  it("does not check the box when checkBoxOnDone is false", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, columns, false);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[3]); // Done
    expect(vault.files["a.md"]).toBe("- [ ] Triage #done");
  });

  it("preserves a non-status tag while changing status", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage #project/x #todo" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[2]); // Doing
    expect(vault.files["a.md"]).toContain("#project/x");
    expect(vault.files["a.md"]).toContain("#doing");
    expect(vault.files["a.md"]).not.toContain("#todo");
  });

  it("preserves a mid comment through a Done transition (cleanup interop)", async () => {
    const line = "- [ ] Reply <!-- mid:ABC= -->";
    const vault = fakeVault({ "a.md": line });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[3]); // Done
    expect(vault.files["a.md"]).toMatch(/- \[x\].*<!-- mid:ABC= -->/);
  });
});

describe("TaskMutator field edits", () => {
  it("sets a due date", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Pay" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setDueDate(task, "2026-06-30");
    expect(vault.files["a.md"]).toBe("- [ ] Pay 📅 2026-06-30");
  });

  it("sets priority", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Pay" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setPriority(task, "high");
    expect(vault.files["a.md"]).toBe("- [ ] Pay ⏫");
  });

  it("sets body text while preserving metadata", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Old text #todo 📅 2026-06-30" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setText(task, "New text");
    expect(vault.files["a.md"]).toContain("New text");
    expect(vault.files["a.md"]).toContain("#todo");
    expect(vault.files["a.md"]).toContain("📅 2026-06-30");
  });
});

describe("TaskMutator.createTask", () => {
  it("appends a new task with the column tag", async () => {
    const vault = fakeVault({ "daily.md": "# Today\n" });
    const m = new TaskMutator(vault as any, columns, true);
    await m.createTask("daily.md", "New thing", columns[1]); // Todo
    expect(vault.files["daily.md"]).toContain("- [ ] New thing #todo");
  });

  it("appends with no tag for the Backlog column", async () => {
    const vault = fakeVault({ "daily.md": "# Today" });
    const m = new TaskMutator(vault as any, columns, true);
    await m.createTask("daily.md", "Untriaged", columns[0]); // Backlog
    expect(vault.files["daily.md"]).toContain("- [ ] Untriaged");
    expect(vault.files["daily.md"]).not.toContain("- [ ] Untriaged #");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/mutator/mutator.test.ts`
Expected: FAIL — cannot resolve `./TaskMutator`.

- [ ] **Step 3: Write minimal implementation**

Create `src/mutator/TaskMutator.ts`:

```ts
import { TFile, Vault } from "obsidian";
import { Task, Column, Priority } from "../types";
import { parseLine } from "../parser/parseLine";
import { serializeTask } from "../parser/serializeTask";

/**
 * The only unit that writes task lines to disk. Each operation re-reads the
 * target line by line number, re-parses it to confirm identity, applies the
 * change, and writes it back atomically via vault.process.
 *
 * Returns the intended new Task so the view can render optimistically; the
 * subsequent vault modify event will reconcile via the index.
 */
export class TaskMutator {
  constructor(
    private vault: Vault,
    private columns: Column[],
    private checkBoxOnDone: boolean
  ) {}

  private statusTags(): string[] {
    return this.columns
      .map((c) => c.tag)
      .filter((t): t is string => t !== null);
  }

  /** Apply a transform to a single line of a file, writing the result back. */
  private async mutateLine(
    task: Task,
    transform: (parsed: Task) => Task
  ): Promise<Task | null> {
    const file = this.vault.getAbstractFileByPath(task.filePath);
    if (!file) return null;

    let updated: Task | null = null;
    await this.vault.process(file as TFile, (data) => {
      const lines = data.split("\n");
      const current = parseLine(
        lines[task.lineNumber],
        task.filePath,
        task.lineNumber
      );
      // Guard: line must still be a task with the same body (identity check).
      if (!current || current.body !== task.body) return data;
      updated = transform(current);
      lines[task.lineNumber] = serializeTask(updated);
      return lines.join("\n");
    });
    return updated;
  }

  async setStatus(task: Task, column: Column): Promise<Task | null> {
    const statusTags = this.statusTags();
    const isDoneColumn = column.name.toLowerCase() === "done";
    return this.mutateLine(task, (parsed) => {
      // Remove every board status tag, then add the target column's tag.
      const kept = parsed.tags.filter((t) => !statusTags.includes(t));
      const nextTags = column.tag !== null ? [column.tag, ...kept] : kept;

      let checked = parsed.checked;
      if (isDoneColumn && this.checkBoxOnDone) checked = true;
      else if (!isDoneColumn && parsed.checked) checked = false;

      return { ...parsed, tags: nextTags, checked };
    });
  }

  async setDueDate(task: Task, dueDate: string | null): Promise<Task | null> {
    return this.mutateLine(task, (parsed) => ({ ...parsed, dueDate }));
  }

  async setPriority(task: Task, priority: Priority): Promise<Task | null> {
    return this.mutateLine(task, (parsed) => ({ ...parsed, priority }));
  }

  async setText(task: Task, body: string): Promise<Task | null> {
    return this.mutateLine(task, (parsed) => ({ ...parsed, body }));
  }

  /**
   * Append a new task line to a destination file. Creates a `- [ ]` line with
   * the column's status tag (if any). Returns the new line's text.
   */
  async createTask(
    destPath: string,
    body: string,
    column: Column
  ): Promise<string | null> {
    const file = this.vault.getAbstractFileByPath(destPath);
    if (!file) return null;
    const tag = column.tag ? ` ${column.tag}` : "";
    const newLine = `- [ ] ${body}${tag}`;
    await this.vault.process(file as TFile, (data) => {
      const sep = data.length > 0 && !data.endsWith("\n") ? "\n" : "";
      return data + sep + newLine + "\n";
    });
    return newLine;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/mutator/mutator.test.ts`
Expected: PASS (all setStatus + field-edit + createTask tests).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites (parser, excludes, deriveColumns, boardConfig, index, mutator) green.

- [ ] **Step 6: Commit**

```bash
git add src/mutator/TaskMutator.ts src/mutator/mutator.test.ts
git commit -m "feat: add TaskMutator with status/field edits and create"
```

---

## Task 12: Daily note resolution

**Files:**
- Create: `src/util/dailyNote.ts`
- Test: `src/util/dailyNote.test.ts`

The date-to-filename formatting is testable in isolation; the create-if-missing path uses Obsidian APIs and is verified manually.

- [ ] **Step 1: Write the failing test**

Create `src/util/dailyNote.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dailyNotePath } from "./dailyNote";

describe("dailyNotePath", () => {
  const date = new Date(2026, 5, 5); // 2026-06-05 (month is 0-based)

  it("formats MM-DD-YYYY under the folder", () => {
    expect(dailyNotePath("00_DailyNotes", "MM-DD-YYYY", date)).toBe(
      "00_DailyNotes/06-05-2026.md"
    );
  });

  it("formats YYYY-MM-DD", () => {
    expect(dailyNotePath("Journal", "YYYY-MM-DD", date)).toBe(
      "Journal/2026-06-05.md"
    );
  });

  it("handles a trailing slash on the folder", () => {
    expect(dailyNotePath("Journal/", "YYYY-MM-DD", date)).toBe(
      "Journal/2026-06-05.md"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/util/dailyNote.test.ts`
Expected: FAIL — cannot resolve `./dailyNote`.

- [ ] **Step 3: Write minimal implementation**

Create `src/util/dailyNote.ts`:

```ts
import { App, TFile, normalizePath } from "obsidian";

/** Format a date with a tiny subset of moment tokens: YYYY, MM, DD. */
function formatDate(format: string, date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return format.replace("YYYY", yyyy).replace("MM", mm).replace("DD", dd);
}

/** Build the vault-relative path of the daily note for a given date. */
export function dailyNotePath(
  folder: string,
  format: string,
  date: Date
): string {
  const cleanFolder = folder.replace(/\/+$/, "");
  return `${cleanFolder}/${formatDate(format, date)}.md`;
}

/**
 * Resolve today's daily note, creating an empty file if it doesn't exist.
 * Returns the TFile, or null if creation failed.
 */
export async function resolveTodayDailyNote(
  app: App,
  folder: string,
  format: string,
  date: Date
): Promise<TFile | null> {
  const path = normalizePath(dailyNotePath(folder, format, date));
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  // Ensure the folder exists.
  const folderPath = normalizePath(folder.replace(/\/+$/, ""));
  if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
    try {
      await app.vault.createFolder(folderPath);
    } catch {
      // Folder may have been created concurrently; ignore.
    }
  }

  try {
    return await app.vault.create(path, "");
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/util/dailyNote.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/util/dailyNote.ts src/util/dailyNote.test.ts
git commit -m "feat: add daily note path resolution and create-if-missing"
```

---

## Task 13: Settings

**Files:**
- Create: `src/settings.ts`

This task has no unit test (it's an Obsidian UI surface + a plain data default). Verified by compile + manual smoke test later. Note: `src/settings.ts` imports `./main`, which does not exist until Task 16 — so a standalone `tsc` here will report exactly one error (the missing `./main` import). That is expected and resolves in Task 16.

- [ ] **Step 1: Create `src/settings.ts`**

```ts
import { App, PluginSettingTab, Setting } from "obsidian";
import { Column } from "./types";
import type TaskboardPlugin from "./main";

export interface Settings {
  dailyNotesFolder: string;
  newTaskDailyNoteFormat: string;
  excludeFolders: string[];
  excludeFiles: string[];
  excludeTags: string[];
  defaultColumns: Column[];
  checkBoxOnDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyNotesFolder: "00_DailyNotes",
  newTaskDailyNoteFormat: "MM-DD-YYYY",
  excludeFolders: ["Templates"],
  excludeFiles: [],
  excludeTags: ["#archived"],
  defaultColumns: [
    { name: "Backlog", tag: null },
    { name: "Todo", tag: "#todo" },
    { name: "Doing", tag: "#doing" },
    { name: "Done", tag: "#done" },
  ],
  checkBoxOnDone: true,
};

/** Parse a textarea (one entry per line) into a trimmed, non-empty string array. */
function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export class TaskboardSettingTab extends PluginSettingTab {
  plugin: TaskboardPlugin;

  constructor(app: App, plugin: TaskboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Daily notes folder")
      .setDesc("Vault-relative folder where daily notes live.")
      .addText((t) =>
        t.setValue(this.plugin.settings.dailyNotesFolder).onChange(async (v) => {
          this.plugin.settings.dailyNotesFolder = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Daily note filename format")
      .setDesc("Date format for resolving today's note: YYYY, MM, DD tokens.")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.newTaskDailyNoteFormat)
          .onChange(async (v) => {
            this.plugin.settings.newTaskDailyNoteFormat = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("One glob per line (e.g. Templates, Archive/**).")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeFolders.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeFolders = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude files")
      .setDesc("One exact vault-relative path per line.")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeFiles.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeFiles = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude tags")
      .setDesc("One tag per line (e.g. #archived). Tasks with any are hidden.")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeTags.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeTags = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Check the box on Done")
      .setDesc("When a card moves to a Done column, also mark the task [x].")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.checkBoxOnDone).onChange(async (v) => {
          this.plugin.settings.checkBoxOnDone = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
```

- [ ] **Step 2: Verify it compiles (one expected error)**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: exactly one error — `Cannot find module './main'` from `settings.ts`. This is expected; `main.ts` is Task 16. Confirm there are no OTHER errors.

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add Settings interface, defaults, and settings tab"
```

---

## Task 14: Preact components (Card, Column, Board) + subscription hook

**Files:**
- Create: `src/view/hooks.ts`
- Create: `src/view/Card.tsx`
- Create: `src/view/Column.tsx`
- Create: `src/view/Board.tsx`

No unit tests — UI is smoke-tested in Obsidian (Task 17). Verify via `tsc`.

- [ ] **Step 1: Create `src/view/hooks.ts`**

```ts
import { useEffect, useState } from "preact/hooks";
import { TaskIndex } from "../index/TaskIndex";
import { Task } from "../types";

/**
 * Subscribe to a TaskIndex and re-render on any index event.
 * Returns the current full task list (debounced at 50ms to batch bursts).
 */
export function useTaskIndex(index: TaskIndex): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() => index.allTasks());

  useEffect(() => {
    let timer: number | null = null;
    const refresh = () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        setTasks(index.allTasks());
      }, 50);
    };
    index.on(refresh);
    refresh();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [index]);

  return tasks;
}
```

- [ ] **Step 2: Create `src/view/Card.tsx`**

```tsx
import { Task, Priority } from "../types";

interface CardProps {
  task: Task;
  onOpenSource: (task: Task) => void;
  onEditText: (task: Task, body: string) => void;
  onSetDue: (task: Task, due: string | null) => void;
  onCyclePriority: (task: Task) => void;
}

const PRIORITY_LABEL: Record<Exclude<Priority, null>, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

function dueClass(due: string | null): string {
  if (!due) return "";
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due < todayStr) return "tb-due-overdue";
  if (due === todayStr) return "tb-due-today";
  return "tb-due-upcoming";
}

export function Card({
  task,
  onOpenSource,
  onEditText,
  onSetDue,
  onCyclePriority,
}: CardProps) {
  return (
    <div class="tb-card">
      <div
        class="tb-card-body"
        onClick={() => {
          const next = prompt("Edit task", task.body);
          if (next !== null && next.trim() !== "" && next !== task.body) {
            onEditText(task, next.trim());
          }
        }}
      >
        {task.body}
      </div>
      <div class="tb-card-meta">
        {task.dueDate && (
          <span
            class={`tb-chip ${dueClass(task.dueDate)}`}
            onClick={() => {
              const next = prompt(
                "Due date (YYYY-MM-DD or empty)",
                task.dueDate ?? ""
              );
              if (next !== null)
                onSetDue(task, next.trim() === "" ? null : next.trim());
            }}
          >
            📅 {task.dueDate}
          </span>
        )}
        {task.priority && (
          <span
            class="tb-chip tb-priority"
            onClick={() => onCyclePriority(task)}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        <span
          class="tb-source-link"
          onClick={() => onOpenSource(task)}
          title={task.filePath}
        >
          {task.filePath.split("/").pop()}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/view/Column.tsx`**

```tsx
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Task, Column as ColumnType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAdd: (column: ColumnType, body: string) => void;
  onOpenSource: (task: Task) => void;
  onEditText: (task: Task, body: string) => void;
  onSetDue: (task: Task, due: string | null) => void;
  onCyclePriority: (task: Task) => void;
}

export function Column({
  column,
  tasks,
  onAdd,
  onOpenSource,
  onEditText,
  onSetDue,
  onCyclePriority,
}: ColumnProps) {
  return (
    <div class="tb-column">
      <div class="tb-column-header">
        <span class="tb-column-name">{column.name}</span>
        <span class="tb-column-count">{tasks.length}</span>
        <button
          class="tb-add-btn"
          onClick={() => {
            const body = prompt(`New task in ${column.name}`);
            if (body && body.trim()) onAdd(column, body.trim());
          }}
        >
          +
        </button>
      </div>
      <Droppable droppableId={column.name}>
        {(provided) => (
          <div
            class="tb-column-body"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {tasks.length === 0 && <div class="tb-empty">Drop tasks here</div>}
            {tasks.map((task, i) => (
              <Draggable draggableId={task.id} index={i} key={task.id}>
                {(dp) => (
                  <div
                    ref={dp.innerRef}
                    {...dp.draggableProps}
                    {...dp.dragHandleProps}
                  >
                    <Card
                      task={task}
                      onOpenSource={onOpenSource}
                      onEditText={onEditText}
                      onSetDue={onSetDue}
                      onCyclePriority={onCyclePriority}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/view/Board.tsx`**

```tsx
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { TaskIndex } from "../index/TaskIndex";
import { TaskMutator } from "../mutator/TaskMutator";
import { BoardConfig, Task, Priority, Column as ColumnType } from "../types";
import { useTaskIndex } from "./hooks";
import { deriveColumns, MtimeMap } from "./deriveColumns";
import { Column } from "./Column";

interface BoardProps {
  index: TaskIndex;
  mutator: TaskMutator;
  config: BoardConfig;
  mtimes: MtimeMap;
  onOpenSource: (task: Task) => void;
  onAdd: (column: ColumnType, body: string) => void;
}

const PRIORITY_CYCLE: Priority[] = [
  null,
  "lowest",
  "low",
  "medium",
  "high",
  "highest",
];

export function Board({
  index,
  mutator,
  config,
  mtimes,
  onOpenSource,
  onAdd,
}: BoardProps) {
  const tasks = useTaskIndex(index);
  const grouped = deriveColumns(tasks, config.columns, mtimes);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const task = byId.get(result.draggableId);
    if (!task) return;
    const target = config.columns.find(
      (c) => c.name === result.destination!.droppableId
    );
    if (!target) return;
    void mutator.setStatus(task, target);
  };

  const onCyclePriority = (task: Task) => {
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    void mutator.setPriority(task, next);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div class="tb-board">
        {config.columns.map((col) => (
          <Column
            key={col.name}
            column={col}
            tasks={grouped[col.name] ?? []}
            onAdd={onAdd}
            onOpenSource={onOpenSource}
            onEditText={(t, body) => void mutator.setText(t, body)}
            onSetDue={(t, due) => void mutator.setDueDate(t, due)}
            onCyclePriority={onCyclePriority}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: only the known `./main` import error from `settings.ts` (resolved in Task 16). No errors in `view/`.

- [ ] **Step 6: Commit**

```bash
git add src/view/hooks.ts src/view/Card.tsx src/view/Column.tsx src/view/Board.tsx
git commit -m "feat: add Preact Board/Column/Card components and index hook"
```

---

## Task 15: BoardView ItemView shell

**Files:**
- Create: `src/view/BoardView.tsx`

- [ ] **Step 1: Create `src/view/BoardView.tsx`**

```tsx
import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";
import { render, h } from "preact";
import { TaskIndex } from "../index/TaskIndex";
import { TaskMutator } from "../mutator/TaskMutator";
import { Settings } from "../settings";
import { Task, Column } from "../types";
import { parseBoardConfig } from "./boardConfig";
import { MtimeMap } from "./deriveColumns";
import { Board } from "./Board";
import { resolveTodayDailyNote } from "../util/dailyNote";

export const TASKBOARD_VIEW_TYPE = "taskboard-view";

/**
 * Obsidian ItemView that renders a board for a specific board note.
 * The board note's path is stored in view state so the view can re-read
 * its frontmatter config.
 */
export class BoardView extends ItemView {
  private boardFilePath: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private index: TaskIndex,
    private settings: Settings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TASKBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.boardFilePath
      ? `Board: ${this.boardFilePath.split("/").pop()}`
      : "Taskboard";
  }

  getIcon(): string {
    return "kanban-square";
  }

  async setState(state: unknown, result: unknown): Promise<void> {
    if (state && typeof state === "object" && "boardFilePath" in state) {
      this.boardFilePath = (state as { boardFilePath: string }).boardFilePath;
    }
    await super.setState(state as never, result as never);
    this.renderBoard();
  }

  getState(): Record<string, unknown> {
    return { boardFilePath: this.boardFilePath };
  }

  async onOpen(): Promise<void> {
    this.renderBoard();
  }

  async onClose(): Promise<void> {
    render(null, this.contentEl);
  }

  /** Build an mtime map from the current loaded files. */
  private buildMtimes(): MtimeMap {
    const map: MtimeMap = {};
    for (const f of this.app.vault.getMarkdownFiles()) {
      map[f.path] = f.stat.mtime;
    }
    return map;
  }

  private renderBoard(): void {
    const container = this.contentEl;
    container.empty();

    const fm =
      this.boardFilePath != null
        ? this.app.metadataCache.getCache(this.boardFilePath)?.frontmatter
        : undefined;
    const config = parseBoardConfig(
      fm as Record<string, unknown> | undefined,
      this.settings.defaultColumns
    );

    const mutator = new TaskMutator(
      this.app.vault,
      config.columns,
      this.settings.checkBoxOnDone
    );

    const onOpenSource = (task: Task) => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (file instanceof TFile) {
        void this.app.workspace
          .getLeaf(false)
          .openFile(file)
          .then(() => {
            const view =
              this.app.workspace.getActiveViewOfType(MarkdownView);
            view?.editor.setCursor({ line: task.lineNumber, ch: 0 });
          });
      }
    };

    const onAdd = async (column: Column, body: string) => {
      let destPath: string | null = null;
      if (config.newTaskDestination === "daily_note") {
        const file = await resolveTodayDailyNote(
          this.app,
          this.settings.dailyNotesFolder,
          this.settings.newTaskDailyNoteFormat,
          new Date()
        );
        destPath = file ? file.path : null;
      } else {
        destPath = config.newTaskDestination;
      }
      if (destPath) await mutator.createTask(destPath, body, column);
    };

    render(
      h(Board, {
        index: this.index,
        mutator,
        config,
        mtimes: this.buildMtimes(),
        onOpenSource,
        onAdd,
      }),
      container
    );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: only the known `./main` import error from `settings.ts`. No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/view/BoardView.tsx
git commit -m "feat: add BoardView ItemView shell"
```

---

## Task 16: Plugin entry point (main.ts) wiring

**Files:**
- Create: `src/main.ts`
- Create: `styles.css`

- [ ] **Step 1: Create `src/main.ts`**

```ts
import { Plugin, TFile, WorkspaceLeaf, debounce, Notice } from "obsidian";
import { Settings, DEFAULT_SETTINGS, TaskboardSettingTab } from "./settings";
import { TaskIndex } from "./index/TaskIndex";
import { BoardView, TASKBOARD_VIEW_TYPE } from "./view/BoardView";
import { isBoardFrontmatter } from "./view/boardConfig";

export default class TaskboardPlugin extends Plugin {
  settings!: Settings;
  index!: TaskIndex;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.index = new TaskIndex(this.app.vault, this.settings);

    // Build the index after the layout is ready (vault is fully available).
    this.app.workspace.onLayoutReady(async () => {
      await this.index.scan();
    });

    this.registerView(
      TASKBOARD_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new BoardView(leaf, this.index, this.settings)
    );

    this.registerVaultEvents();
    this.registerCommands();

    this.addRibbonIcon("kanban-square", "Open taskboard", () => {
      void this.openBoardForActiveFile();
    });

    this.addSettingTab(new TaskboardSettingTab(this.app, this));
  }

  private registerVaultEvents(): void {
    const onModify = debounce(
      (file: TFile) => void this.index.onModify(file),
      150,
      true
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") onModify(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) void this.index.onCreate(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) this.index.onDelete(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) void this.index.onRename(file, oldPath);
      })
    );
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-as-board",
      name: "Open current note as board",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        const isBoard =
          !!file &&
          isBoardFrontmatter(
            this.app.metadataCache.getFileCache(file)?.frontmatter
          );
        if (isBoard && !checking) void this.openBoard(file!);
        return isBoard;
      },
    });
  }

  private async openBoardForActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("Open a note with `taskboard: true` first.");
      return;
    }
    if (
      !isBoardFrontmatter(
        this.app.metadataCache.getFileCache(file)?.frontmatter
      )
    ) {
      new Notice("This note is not a taskboard (add `taskboard: true`).");
      return;
    }
    await this.openBoard(file);
  }

  private async openBoard(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: TASKBOARD_VIEW_TYPE,
      state: { boardFilePath: file.path },
      active: true,
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 2: Create `styles.css`**

```css
.tb-board {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  height: 100%;
  padding: 8px;
}
.tb-column {
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 260px;
  background: var(--background-secondary);
  border-radius: 8px;
  padding: 8px;
}
.tb-column-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 8px;
}
.tb-column-count {
  color: var(--text-muted);
  font-weight: 400;
}
.tb-add-btn {
  margin-left: auto;
  cursor: pointer;
}
.tb-column-body {
  flex: 1;
  overflow-y: auto;
  min-height: 40px;
}
.tb-card {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
}
.tb-card-body {
  cursor: text;
  white-space: pre-wrap;
}
.tb-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  font-size: 0.8em;
}
.tb-chip {
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--background-modifier-border);
  cursor: pointer;
}
.tb-due-overdue {
  background: var(--color-red);
  color: white;
}
.tb-due-today {
  background: var(--color-orange);
  color: white;
}
.tb-source-link {
  color: var(--text-accent);
  cursor: pointer;
  margin-left: auto;
}
.tb-empty {
  color: var(--text-faint);
  font-size: 0.85em;
  text-align: center;
  padding: 12px 0;
}
```

- [ ] **Step 3: Verify the whole project compiles**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: NO errors (the `./main` import in `settings.ts` now resolves).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 5: Build the bundle**

Run: `npm run build`
Expected: completes; `main.js` is produced at the project root.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts styles.css
git commit -m "feat: wire plugin entry point, vault events, commands, styles"
```

---

## Task 17: Manual smoke test in Obsidian

**Files:** none (manual verification).

This task has no code. It verifies the plugin end-to-end in a real vault, including the cleanup.sh interop. Use a NON-critical / backed-up vault, or the user's vault with git clean state, since this writes to task lines.

- [ ] **Step 1: Install the plugin into a test vault**

Copy the built plugin into the vault's plugin folder:

```bash
VAULT=/home/mwdavisii/vault
mkdir -p "$VAULT/.obsidian/plugins/obsidian-taskboard"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/obsidian-taskboard/"
```

Expected: three files present in the plugin folder.

- [ ] **Step 2: Enable and create a board note**

In Obsidian: Settings → Community plugins → enable "Taskboard". Create a note `Boards/Work.md` with frontmatter:

```markdown
---
taskboard: true
columns:
  - { name: "Backlog", tag: null }
  - { name: "Todo", tag: "#todo" }
  - { name: "Doing", tag: "#doing" }
  - { name: "Done", tag: "#done" }
new_task_destination: daily_note
---
```

With the note open, run command palette → "Taskboard: Open current note as board".
Expected: a board renders with four columns; existing vault tasks appear (untagged ones in Backlog).

- [ ] **Step 3: Verify drag → file write**

Drag a card from Backlog to Doing. Open the card's source note.
Expected: the source line now has `#doing` appended; the board reflects the move.

- [ ] **Step 4: Verify cleanup.sh interop**

Find a daily note line with `<!-- mid:... -->` (e.g. in `00_DailyNotes/2026/06/06-05-2026.md`), drag its card to Done. Then check the source line:

```bash
grep -E -- '- \[x\].*<!-- mid:' "$VAULT/00_DailyNotes/2026/06/06-05-2026.md"
```

Expected: the dragged line is printed — it is now `- [x] ... #done` AND still contains `<!-- mid:... -->`, so cleanup.sh would archive it.

- [ ] **Step 5: Verify "+ Add" writes to today's daily note**

Click "+" on the Todo column, enter a task. Open today's daily note.
Expected: a new `- [ ] <text> #todo` line at the end of today's daily note; a card appears in Todo.

- [ ] **Step 6: Verify inline edits**

Click a card body and edit text; click a due-date chip and change it; click a priority chip to cycle it. Check each source line.
Expected: each edit is written back, metadata preserved, other fields untouched.

- [ ] **Step 7: Record results**

If all steps pass, the implementation is verified. If any step fails, file the discrepancy and fix with a focused follow-up (write a failing unit test first where the failure is logic, not Obsidian-API wiring).

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Settings (T13), parser + round-trip (T4/T5), interop fixtures (T6), exclusions (T7), index + events (T10), mutator + status contract (T11), daily note create (T12), board config (T9), column derivation/sort (T8), UX components (T14), view shell (T15), wiring + debounce + commands (T16), manual interop verification (T17). The spec's optimistic-update reconciliation is realized by: mutator writes → `modify` event (debounced 150ms in T16) → `TaskIndex.onModify` → `useTaskIndex` 50ms debounce → re-render.
- **Deferred from spec (acceptable for v1, noted so they're not forgotten):** the mtime-keyed cold-start cache (`index/cache.ts` in the spec's file layout) is NOT implemented — the index does a full scan on every load. Fine for the target vault size; add later if cold start becomes slow. Legacy `[(open)](url)` link *stripping* is cleanup.sh's job, not the plugin's. The window-focus re-scan (spec's "stale index on resume") is also deferred; vault `modify` events cover normal editing. Granular `task-added`/`task-removed`/`task-changed` diff events are defined in the `IndexEvent` type but the index emits only `bulk-changed` per file; the view re-renders from the full list, so granular diffs are unnecessary for v1 (the type is kept for forward-compat).
- **Type consistency:** `Column` is `{ name, tag }` everywhere; `setStatus(task, column)` takes a `Column`; `deriveColumns(tasks, columns, mtimes)` matches its caller in `Board.tsx`; `TaskMutator` constructor `(vault, columns, checkBoxOnDone)` matches `BoardView.renderBoard`; `parseLine(line, filePath, lineNumber)` and `serializeTask(task)` signatures are consistent across parser/index/mutator.
```
