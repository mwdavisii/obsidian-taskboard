# Obsidian Taskboard — Design Spec

**Date:** 2026-06-05
**Status:** Approved for implementation planning

## Overview

An Obsidian community plugin that renders a kanban-style board view (drag-drop columns, inline-editable cards, "+ Add card") over markdown `- [ ]` tasks discovered across the vault. UX inspired by [obsidian-community/obsidian-kanban](https://github.com/obsidian-community/obsidian-kanban), but the source of truth is the markdown task lines themselves — not a dedicated kanban file.

A "board" is a `.md` file with `taskboard: true` in frontmatter; opening it in the custom view renders columns based on status tags (`#todo`, `#doing`, etc.) attached to tasks. Tasks are pulled from the entire vault, minus exclusion rules configured in plugin settings (mirroring how the user's Daily Note Dataview template suppresses certain folders/notes).

## Goals

- Drag tasks between columns; the source markdown line is rewritten in-place.
- Inline edit card body, due date, and priority — without leaving the board.
- Create new tasks from the board; they land in today's Daily Note.
- Source-of-truth is markdown. Any external edit to the underlying file is reflected on the board.
- Self-contained: no hard dependency on Tasks plugin, Dataview, or Daily Notes plugin (uses the latter when present; falls back otherwise).

## Non-goals (v1)

- Tasks-plugin or Dataview integration / query syntax reuse.
- Subtask hierarchies on the board (nested checkboxes parse as independent cards).
- Recurring-task editing (🔁 is preserved verbatim but not surfaced).
- Swimlanes or grouping within columns.
- Mobile-specific UX beyond responsive CSS and what the DnD library provides.
- Manual intra-column ordering (sorted automatically in v1; manual order deferred).

## Architecture

Five units, each with one job:

1. **Settings** — Plugin-level config persisted via Obsidian's `loadData`/`saveData`. Daily Notes folder, exclusion patterns (folders/files/tags), default new-task destination, "check the box on Done" toggle, default column set for new boards.

2. **TaskParser** — Pure functions. `parseLine(text) → Task | null` and `serializeTask(task) → string`. Round-trippable: parse → serialize → parse yields the same task (semantically, not byte-identical). Knows nothing about boards or status — emits all tags verbatim. No vault access; fully unit-testable.

3. **TaskIndex** — Owns `Map<taskId, Task>` plus secondary `Map<filePath, taskId[]>`. On plugin load, scans `app.vault.getMarkdownFiles()`, applies exclusion rules, parses tasks, populates the index. Subscribes to vault events (`modify`, `create`, `delete`, `rename`) and updates incrementally. Emits typed `IndexEvent`s. Persists an mtime-keyed cache to plugin storage so subsequent loads skip unchanged files.

4. **TaskMutator** — The only unit that writes to disk. Exposes `setStatus`, `setDueDate`, `setPriority`, `setText`, `createTask`. Each call uses `vault.process(file, content => ...)` for atomic read-modify-write of the target line. Returns the intended new `Task` for optimistic UI; the subsequent `modify` event reconciles via the index.

5. **BoardView** — Obsidian `ItemView` registered as `taskboard-view`. Reads board config from the host `.md` file's frontmatter (columns, optional overrides). Subscribes to `TaskIndex`. Renders columns + cards via Preact. Handles drag-drop, inline edit, "+ Add card"; dispatches to `TaskMutator`.

### Data flow (drag example)

```
BoardView.onDragEnd
  └─ optimistic re-render
  └─ TaskMutator.setStatus(taskId, newColumn.tag)
        └─ vault.process(file, content => rewrite line)
              └─ Obsidian fires vault.modify(file)
                    └─ TaskIndex re-parses file, diffs vs prior state
                          └─ emits task-changed / bulk-changed
                                └─ BoardView reconciles (usually no-op vs optimistic)
```

The plugin never edits its own DOM in response to its own drag without writing the file first; file = truth.

## Data model

### `Task`

```ts
type Priority = "highest" | "high" | "medium" | "low" | "lowest" | null

interface Task {
  id: string              // hash(filePath + body) — stable across surrounding edits
  filePath: string        // vault-relative
  lineNumber: number      // 0-based, current; recomputed on each parse
  rawLine: string         // verbatim source line at parse time (round-trip safety)
  checked: boolean        // [x] vs [ ]
  body: string            // task text with recognized metadata stripped
  dueDate: string | null  // ISO YYYY-MM-DD from 📅
  priority: Priority      // from ⏫ 🔺 🔽 ⏬ 🔼
  tags: string[]          // all #tags on the line; no status/non-status distinction here
  trailing: string        // unrecognized metadata preserved verbatim for round-trip
}
```

A task has no `status` field. **Status is derived per-board** at render time: given a board's `columns[].tag` set, the first column tag found in `Task.tags` determines which column the card lands in; tasks with no matching tag fall into the column whose `tag` is `null` (Backlog). This means the same task can appear in different positions on different boards — intentional, since columns are board-defined.

**Why `id` is a hash, not `filePath:line`:** line numbers shift when lines above are inserted/deleted. Hashing `filePath + body` lets a task's identity survive surrounding edits. Two textually-identical tasks in the same file are treated as the same card — acceptable for our use.

### Board config (frontmatter)

```yaml
---
taskboard: true
columns:
  - { name: "Backlog", tag: null }     # null = catch-all for un-tagged tasks
  - { name: "Todo",    tag: "#todo" }
  - { name: "Doing",   tag: "#doing" }
  - { name: "Done",    tag: "#done" }
new_task_destination: daily_note       # or vault-relative path
---
```

Opening this file in `taskboard-view` renders the board. Opening it as normal markdown shows the frontmatter (harmless). A command toggles views; the choice is remembered per file.

### Settings

```ts
interface Settings {
  dailyNotesFolder: string              // e.g. "Journal/Daily"
  newTaskDailyNoteFormat: string        // moment format, e.g. "YYYY-MM-DD"
  excludeFolders: string[]              // glob patterns: ["Templates", "Archive/**"]
  excludeFiles: string[]                // exact vault-relative paths
  excludeTags: string[]                 // tasks bearing any of these are hidden
  defaultColumns: Column[]              // template for new boards
  checkBoxOnDone: boolean               // default: true
}
```

### Status-encoding contract (enforced by `TaskMutator`)

- Drag to column with non-null tag → ensure that tag present; remove other status tags listed in this board's column set; leave non-status tags untouched.
- Drag to column with `tag: null` (Backlog) → remove all status tags listed in this board.
- Drag to Done column → also set `[x]` if `checkBoxOnDone` is true.
- Drag out of Done → set `[ ]`.

## Parsing & serialization

### Recognized shape

```
<indent>- [<state>] <body> [📅 YYYY-MM-DD] [⏫|🔺|🔽|⏬|🔼] [#tag ...] [<trailing>]
```

### `parseLine`

1. Match `^(\s*)- \[([ xX/\-])\]\s+(.*)$`. No match → return `null`.
2. From a working copy of the body, extract and remove:
   - Due date: `📅\s+(\d{4}-\d{2}-\d{2})`
   - Priority: one of `⏫ 🔺 🔽 ⏬ 🔼`
   - Tags: `#[\w\-/]+` — collected into `tags` and removed from the working copy.
3. Whatever remains in the working copy → `body` (trimmed) plus `trailing` for any unrecognized fragments at the end (Tasks-plugin fields we don't surface). Heuristic: anything after the last recognized field that doesn't match a known shape goes into `trailing`.

### `serializeTask`

Always emit fields in a fixed order so round-trip is stable:

```
<indent>- [<state>] <body> [📅 YYYY-MM-DD] [<priority emoji>] [#tag ...] [<trailing>]
```

- `<state>`: `x` if `checked`, else ` `. We do not write alternate states (`/`, `-`).
- Single space between fields. No trailing whitespace.
- Null/empty fields are omitted (no double spaces).
- Tag order on write: the per-board "status" tag (if any) is emitted first within the tag list — `TaskMutator` controls tag ordering so column-defining tags read first. The parser does not need to preserve original tag order.

### Round-trip guarantee

For any line `parseLine` accepts: `serialize(parse(line))` re-parses to the same `Task`. Enforced by unit tests with a fuzz suite of representative lines.

### Preserve-and-ignore (v1)

Tasks-plugin fields not surfaced in v1 — 🛫 start, ⏳ scheduled, ➕ created, 🔁 recurrence, ✅ completion — are captured into `trailing` and emitted verbatim. They survive edits we make; we just don't expose them in card UI.

## Indexing & vault events

### Initial scan (on plugin load)

1. `app.vault.getMarkdownFiles()` → filter by exclusion rules.
2. For each file: read content, `splitlines`, run `parseLine` on each. Collect tasks.
3. Build `Map<taskId, Task>` + secondary `Map<filePath, taskId[]>`.
4. Persist mtime-keyed cache (`{ filePath: { mtime, tasks } }`) via `saveData`. Next launch: skip files whose `mtime` matches the cache.

### Incremental updates

| Event | Action |
|---|---|
| `vault.on('modify', file)` | Drop tasks for `file.path`; re-parse; re-add; emit diff. |
| `vault.on('create', file)` | If `.md` and not excluded: parse + add. |
| `vault.on('delete', file)` | Drop all tasks for that path. |
| `vault.on('rename', file, oldPath)` | Move taskIds from `oldPath` to `file.path`; update `filePath` field on each. |
| `metadataCache.on('changed')` | Not subscribed (we own parsing). |

### Debouncing

- File-modify events coalesced per-file at 150ms trailing.
- `BoardView` debounces its own re-render at 50ms to batch multi-file events.

### Optimistic updates

`TaskMutator` returns the intended new `Task`. `BoardView` re-renders immediately from that. The subsequent `modify` event from the index either confirms (no visible change) or, in the rare write-failure case, corrects.

### Exclusion application

- Folder/file exclusions filter the **file list** — those files are never read.
- Tag exclusions filter **individual tasks** — file is parsed; matching tasks are dropped from the index.

### Index event types

```ts
type IndexEvent =
  | { type: "task-added";   task: Task }
  | { type: "task-removed"; taskId: string }
  | { type: "task-changed"; before: Task; after: Task }
  | { type: "bulk-changed"; filePath: string }
```

### Failure modes

- File parse throws (defensive): log, drop file from index, continue. One-time notice on the board.
- Mutator write fails: surface a notice; revert the optimistic UI change.
- Resume from sleep / stale index: on `workspace.on('window-focus')`, re-scan files whose `mtime` is newer than cache.

## BoardView UX

### View registration

- Custom view type: `taskboard-view`.
- Opening a `.md` with `taskboard: true` offers a one-click "Open as board" (choice remembered per file).
- Commands: "Taskboard: Open as board", "Taskboard: Open as markdown".
- Ribbon icon: opens (or creates) a default board file at a configured path.

### Layout

Horizontal scrolling column strip. Each column: header (name, count, "+ Add", collapse), body (vertically scrolling list of cards), highlight on active drop target.

### Card

- Title line: task body, markdown-rendered inline (links, bold).
- Metadata row (only shown when present): 📅 due date chip color-coded (overdue / today / upcoming), priority chip, source link (filename → click jumps to line).
- States: normal, hover, dragging, editing.

### Interactions

| Action | Behavior |
|---|---|
| Drag card to another column | Optimistic move → `TaskMutator.setStatus` → index event confirms. |
| Drag within column | No-op in v1 (sort is automatic). |
| Click card body | Enters inline edit (textarea). Esc cancels, Enter / blur commits via `setText`. |
| Click 📅 chip | Date picker; commits via `setDueDate`. |
| Click priority chip | Cycles through priorities (or opens popover); commits via `setPriority`. |
| Click source link | `workspace.openLinkText(filePath, '', false)`; scroll to `lineNumber`. |
| "+ Add" in column | Inline new-card input at column top. On commit: `TaskMutator.createTask(text, todaysDailyNote, column.tag)`. If today's daily note doesn't exist, create via Daily Notes plugin API (fallback: `dailyNotesFolder/<formatted-date>.md`). |
| Right-click card | Context menu: Open source, Delete task, Copy markdown. |

### Drag-and-drop

`@hello-pangea/dnd` (maintained fork of `react-beautiful-dnd`). Wired to Preact via `preact/compat`. Handles touch + keyboard accessibility.

### Sort within column (v1)

Automatic, fixed: due date (nulls last) → priority (highest first) → source-file mtime (recent first).

### Empty states

- Empty column: subtle "Drop tasks here" placeholder.
- No tasks anywhere: hint pointing at Settings → exclusions.
- Board file missing frontmatter: "Initialize as board" button writes defaults from Settings.

## Tech stack

- **TypeScript** strict mode.
- **Build:** `esbuild` (Obsidian sample plugin's default).
- **UI:** **Preact** rendered into the `ItemView` container. Hooks + a small event-emitter bridge from `TaskIndex` for state; no Redux/Zustand.
- **DnD:** `@hello-pangea/dnd` via `preact/compat`.
- **Testing:** `vitest` for `TaskParser` and `TaskMutator`. Manual smoke testing for `BoardView` and event wiring. No e2e harness in v1.

## Repo layout

```
obsidian-taskboard/
  manifest.json
  package.json
  esbuild.config.mjs
  tsconfig.json
  src/
    main.ts                  # Plugin class: lifecycle, command/view registration
    settings.ts              # Settings interface + SettingsTab
    types.ts                 # Task, Column, BoardConfig, IndexEvent
    parser/
      parseLine.ts
      serializeTask.ts
      parser.test.ts
    index/
      TaskIndex.ts           # in-memory index + vault event wiring
      cache.ts               # mtime-keyed persistence
    mutator/
      TaskMutator.ts
      mutator.test.ts
    view/
      BoardView.tsx          # ItemView shell
      Board.tsx              # Preact root
      Column.tsx
      Card.tsx
      hooks.ts               # useTaskIndex, useBoardConfig
    util/
      dailyNote.ts           # resolve today's daily note; create-if-missing
      excludes.ts            # apply Settings exclusion rules
  docs/superpowers/specs/    # this spec lives here
  README.md
```

## Manifest

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

## Testing strategy

- **Parser (`vitest`):** fixture lines covering plain tasks, all metadata combinations, unsupported-but-preserved fields, indentation, nested lists. Round-trip property test: `serialize(parse(x))` re-parses identically.
- **Mutator (`vitest`):** in-memory vault mock; verify `setStatus` adds/removes correct tags, `setText` preserves metadata, `createTask` writes to the right destination file, "Done" transitions flip the checkbox when configured.
- **Index (`vitest`):** mock vault events; verify add/remove/rename/modify update the index and emit the right diffs; verify mtime cache short-circuits unchanged files on warm start.
- **BoardView:** manual smoke test inside Obsidian against a fixture vault. v1 has no automated UI tests.

## Risks & open items

- **`@hello-pangea/dnd` × Preact compat:** library is React-targeted; runs via `preact/compat`. We should validate this works in an Obsidian plugin context early — if it doesn't, fall back to `SortableJS` (framework-agnostic) and accept a small loss in keyboard accessibility.
- **Daily Note resolution without Daily Notes plugin:** fallback path uses `dailyNotesFolder + formattedDate`. Edge cases (folder doesn't exist, format collision) → surface a notice and abort the create rather than write to an unexpected location.
- **Vault sync delays (Obsidian Sync, iCloud):** the index reflects what's on disk. If a synced edit lands after a board action, the index event will reconcile. No special handling in v1.
- **Large vaults (>10k files):** initial scan time may exceed a second. The mtime cache covers warm starts; cold-start cost is accepted for v1 with a note on the settings page.
