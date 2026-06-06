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
