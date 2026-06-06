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
