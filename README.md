# Taskboard

A Kanban board for [Obsidian](https://obsidian.md), sourced directly from the
`- [ ]` checkbox tasks already scattered across your vault. No separate task
database — the markdown *is* the source of truth. A board is just a note with
`taskboard: true` in its frontmatter; the cards on it are real task lines in
your other notes, grouped into columns by tag. Drag a card between columns and
the underlying task line is rewritten in place.

## How it works

- **Tasks are plain markdown.** Any line matching `- [ ] ...` (or `[x]`, `[/]`,
  `[-]`) anywhere in your vault is indexed as a task.
- **Columns are tags.** Each column maps to a status tag (e.g. `#todo`,
  `#doing`, `#done`). A task lands in the first column whose tag it carries.
  The one column with no tag is the catch-all **Backlog**.
- **Dragging rewrites the source.** Moving a card swaps its status tag in the
  original file via an atomic, line-level edit — the rest of the line (and the
  rest of the file) is left untouched.
- **Live updates.** The index watches vault create/modify/delete/rename events,
  so edits made anywhere in your vault show up on the board, and vice-versa.

### Recognized task metadata

Tasks can carry [Obsidian Tasks](https://publish.obsidian.md/tasks/)-style
emoji metadata, which is parsed out for sorting and display:

| Metadata  | Syntax                | Used for                        |
| --------- | --------------------- | ------------------------------- |
| Due date  | `📅 2026-06-30`       | Sort (ascending, undated last)  |
| Priority  | `🔺 ⏫ 🔼 🔽 ⏬`        | Sort (highest → lowest)         |
| Tags      | `#todo` `#project/x`  | Column placement & exclusion    |

Within a column, cards sort by due date, then priority, then most-recently-modified.

## Creating a board

Any of these work:

- **Command palette** → *Taskboard: Create new board* — creates an auto-named
  board in your configured Boards folder and opens it.
- **Right-click a folder** in the file explorer → *New taskboard*.
- **Hand-write a board note** with the frontmatter below, then run
  *Taskboard: Open current note as board* (or click the ribbon icon).

### Board frontmatter

Columns are written as a list of strings in the form `"Name:#tag"` (or just
`"Name"` for the tagless Backlog column), which keeps Obsidian's Properties
panel happy:

```yaml
---
taskboard: true
columns:
  - "Backlog"
  - "Todo:#todo"
  - "Doing:#doing"
  - "Done:#done"
new_task_destination: daily_note
---
```

`new_task_destination` is where newly-created tasks are written: `daily_note`
(today's daily note) or a vault-relative path to a specific file.

## Settings

| Setting                    | Default          | Description                                                  |
| -------------------------- | ---------------- | ------------------------------------------------------------ |
| Daily notes folder         | `00_DailyNotes`  | Where daily notes live (for the `daily_note` destination).   |
| Boards folder              | `Boards`         | Where *Create new board* puts new boards.                    |
| Daily note filename format | `MM-DD-YYYY`     | Date tokens (`YYYY`, `MM`, `DD`) for resolving today's note. |
| Exclude folders            | `Templates`      | Globs to skip when indexing (one per line).                  |
| Exclude files              | —                | Exact vault-relative paths to skip.                          |
| Exclude tags               | `#archived`      | Tasks carrying any of these are hidden.                      |
| Default columns            | Backlog/Todo/Doing/Done | Columns used by new boards and tagless boards.        |
| Check the box on Done      | on               | Also mark a task `[x]` when its card moves to a Done column. |

## Development

Built with [Preact](https://preactjs.com/),
[@hello-pangea/dnd](https://github.com/hello-pangea/dnd) for drag-and-drop, and
[esbuild](https://esbuild.github.io/). Tested with
[Vitest](https://vitest.dev/).

```bash
npm install        # install dependencies
npm run dev        # watch + rebuild main.js into the repo root
npm run build      # type-check, then production build
npm test           # run the unit tests
```

To try it in a vault, symlink (or copy) this repo into
`<vault>/.obsidian/plugins/obsidian-taskboard/` so that `manifest.json`,
`main.js`, and `styles.css` sit alongside each other, then enable **Taskboard**
in Obsidian's community-plugins settings.

### Project layout

```
src/
  main.ts          plugin entry: commands, ribbon, vault-event wiring
  settings.ts      settings model + settings tab UI
  types.ts         core types (Task, Column, BoardConfig)
  parser/          parse a markdown line into a Task; stable task ids; serialize back
  index/           TaskIndex — vault scan + incremental event handling
  mutator/         TaskMutator — the only unit that writes task lines to disk
  view/            BoardView + Preact components (Board, Column, Card), column config & derivation
  util/            daily-note resolution, exclude-glob matching
```

## License

MIT
