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
      work = work.replace(glyph, " ");
      break;
    }
  }

  // Tags (whitespace-prefixed).
  const tags: string[] = [];
  work = work.replace(TAG_RE, (_full, tag) => {
    tags.push(tag);
    return " ";
  });

  // Collapse whitespace gaps left by metadata removal. Note: multi-space runs in
  // the original body text are not preserved (rawLine keeps the verbatim line).
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
