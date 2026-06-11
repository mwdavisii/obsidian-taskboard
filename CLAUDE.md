# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # esbuild watch — rebuilds main.js in repo root on change
npm run build      # tsc -noEmit type-check, then production esbuild bundle
npm test           # vitest run (one-shot)
npm run test:watch # vitest watch
```

Run a single test file or pattern:

```bash
npx vitest run src/parser/parser.test.ts
npx vitest run -t "name of test"
```

There is no linter. Type-checking happens only via `npm run build` — `npm run dev`
does not type-check, so run `tsc -noEmit -skipLibCheck` (or the full build) before
considering a change done.

The build emits a single bundled `main.js` into the repo root (committed). To test
in Obsidian, the repo must sit at `<vault>/.obsidian/plugins/obsidian-taskboard/`
so `manifest.json`, `main.js`, and `styles.css` are siblings.

## Architecture

This is an Obsidian plugin: a Kanban board where **the markdown is the source of
truth**. There is no task database — every `- [ ]`/`[x]`/`[/]`/`[-]` line in the
vault is a task. A "board" is just a note with `taskboard: true` in its frontmatter;
columns are status tags, and dragging a card rewrites the tag on the original task
line in place.

Data flows in one direction with the disk as the round-trip point:

```
vault files ──parse──> TaskIndex ──> Board (Preact) ──user action──> TaskMutator ──write──> vault files
                ▲                                                                                │
                └────────────────────── vault modify event ─────────────────────────────────────┘
```

### Layers (`src/`)

- **`parser/`** — `parseLine` turns one markdown line into a `Task` (or null).
  `serializeTask` is its exact inverse. **These must round-trip**: anything not
  explicitly parsed is preserved verbatim in `Task.trailing`/`rawLine` so a
  parse→serialize cycle never corrupts a line. `taskId.ts` computes a stable id as
  `FNV-1a(filePath + body)` — deliberately independent of line number so the id
  survives edits to surrounding lines.
- **`index/`** — `TaskIndex` is the in-memory store (`byId`, `byFile` maps). It
  parses on read, handles incremental vault create/modify/delete/rename events, and
  emits `IndexEvent`s. **It never writes to disk.**
- **`mutator/`** — `TaskMutator` is the **only unit that writes task lines**. Every
  mutation re-reads the target line by number, re-parses it, and guards on identity
  (`current.body === task.body`) before writing via `vault.process` (atomic).
  Returns the intended new `Task` for optimistic rendering; the resulting vault
  modify event reconciles through the index.
- **`view/`** — `BoardView` is the Obsidian `ItemView` (the board note path lives in
  view state). It renders the `Board` Preact tree and wires callbacks. `boardConfig`
  parses board frontmatter (columns, destination, and the per-board `filter`);
  `boardFilter` applies that filter; `deriveColumns` groups the surviving tasks into
  columns and sorts them; `hooks.ts` (`useTaskIndex`) subscribes the Preact tree to
  index events.
- **`util/`** — daily-note path resolution and exclude-glob matching.

### Key invariants and gotchas

- **`Task` has no stored status.** Status is derived per-board in `deriveColumns`: a
  checked (`[x]`) task goes to the Done column (named "done" or tagged `#done`)
  regardless of its tags — so vault-wide completions (Obsidian Tasks' `[x]` + `✅ date`)
  read as done without a `#done` tag. Otherwise a task lands in the first column whose
  tag it carries; the one column with `tag: null` is the catch-all Backlog. Moving
  columns = swapping the status tag (and the checkbox, per the Done rules below).
- **Board notes auto-open as the board view.** `BoardView` is a custom `ItemView`,
  not bound to the `.md` extension, so anything that re-opens a board note as markdown
  (back/forward navigation, clicking it in the explorer, a workspace restore) would
  show raw markdown instead of the board. `registerBoardAutoView` (a `file-open`
  listener in `main.ts`) detects that and swaps the leaf to the board view. The escape
  hatch is `openBoardNoteAsMarkdown` (the board's pencil action), which opens the note
  in a leaf tracked in `forceMarkdownLeaves` (a `WeakSet`) so it's exempt from the
  swap — that's the only intended way to edit a board's frontmatter as text.
- **Cards per column are capped.** Each `Column` renders at most `maxCardsPerColumn`
  (setting, default 100) draggables — `@hello-pangea/dnd` creates heavy per-item nodes,
  so an unfiltered board over a large vault (thousands of tasks) freezes without the
  cap. The header count still shows the true total; overflow shows a "+N more" hint.
  The intended fix for a board that overflows is a tighter board filter, not a bigger
  cap.
- **Two filtering layers, by design.** Plugin-level excludes (`util/excludes.ts`) run
  at *index time* — those tasks never enter `TaskIndex` (a global baseline). Per-board
  include/exclude filters (`view/boardFilter.ts`) run at *render time* against the full
  index, so each board narrows the shared index without re-scanning. Board filters can
  narrow the global baseline but never re-widen it. Don't push board filters back into
  the index, or boards would fight over a single shared filtered view.
- **Round-trip safety is the parser's contract.** When touching `parseLine`/
  `serializeTask`, keep them inverse and run `parser.test.ts`.
- **Known id-collision case:** two tasks in the same file with identical body text
  hash to the same id, and the mutator's body-only identity guard can't distinguish
  them. Don't "fix" this naively without reading the caveat comments in `TaskMutator`.
- **"Done" column detection** (which flips the checkbox to `[x]`) matches either a
  column literally named `done` (any case) **or** one carrying the `#done` tag — so
  renamed terminal columns still check the box.
- Sort order within a column: due date ascending (undated last) → priority
  (highest→lowest) → file mtime (most recent first).

### Preact, not React

Rendered with Preact via `preact/compat`. Both `esbuild.config.mjs` and `tsconfig.json`
alias `react`/`react-dom` → `preact/compat` and set `jsxImportSource: "preact"`.
Drag-and-drop uses `@hello-pangea/dnd` (the React DnD fork) through that compat alias.

### Tests

Vitest runs in a `node` environment with `obsidian` aliased to `src/__mocks__/obsidian.ts`
(see `vitest.config.ts`) — there is no real Obsidian runtime in tests. Logic lives in
plain `.ts` modules so it can be tested without the `.tsx` view layer; favor putting
new logic in a testable module over inlining it in a component.
