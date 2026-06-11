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
 * The board's terminal column, identified the same way as TaskMutator: named
 * "done" (any case) or carrying the `#done` tag. Checked tasks are routed here.
 */
function findDoneColumn(columns: Column[]): Column | undefined {
  return columns.find(
    (c) => c.name.toLowerCase() === "done" || c.tag === "#done"
  );
}

/**
 * Group tasks into columns, then sort each column. A checked (`[x]`) task goes
 * to the Done column regardless of its tags — completing a task anywhere in the
 * vault (e.g. via the Obsidian Tasks plugin's `[x]` + `✅ date`) reads as done.
 * Otherwise a task lands in the first column whose tag it carries; tasks with no
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
  const doneColumn = findDoneColumn(columns);

  for (const t of tasks) {
    let target: Column | undefined;
    if (t.checked && doneColumn) {
      target = doneColumn;
    } else {
      const match = columns.find(
        (c) => c.tag !== null && t.tags.includes(c.tag)
      );
      target = match ?? nullColumn;
    }
    if (target) result[target.name].push(t);
  }

  for (const col of columns) {
    result[col.name].sort((a, b) => compareTasks(a, b, mtimes));
  }

  return result;
}
