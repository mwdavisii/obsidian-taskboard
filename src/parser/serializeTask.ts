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
