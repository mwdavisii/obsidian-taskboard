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
