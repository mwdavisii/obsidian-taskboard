import { BoardConfig, BoardFilter, Column } from "../types";

/** Frontmatter is whatever Obsidian's metadataCache hands us — an untyped record. */
type Frontmatter = Record<string, unknown> | null | undefined;

export function isBoardFrontmatter(fm: Frontmatter): boolean {
  return !!fm && fm["taskboard"] === true;
}

function normalizeColumn(raw: unknown): Column | null {
  // String form: "Name" (null tag) or "Name:#tag" — the Obsidian-Properties-friendly format.
  if (typeof raw === "string") {
    const idx = raw.indexOf(":");
    if (idx !== -1) {
      const name = raw.slice(0, idx).trim();
      const rest = raw.slice(idx + 1).trim();
      if (name && rest.startsWith("#")) return { name, tag: rest };
    }
    const name = raw.trim();
    return name ? { name, tag: null } : null;
  }
  // Object form: { name, tag } — back-compat for hand-written boards.
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : null;
  if (!name) return null;
  const tag = typeof obj.tag === "string" ? obj.tag : null;
  return { name, tag };
}

/** Coerce a frontmatter value (list or lone scalar) into a trimmed string array. */
function toStringArray(raw: unknown): string[] {
  const arr = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tags may be written with or without a leading `#`; normalize to `#tag`. */
function normalizeTag(t: string): string {
  return t.startsWith("#") ? t : "#" + t;
}

function parseFilter(fm: Frontmatter): BoardFilter {
  const f = fm ?? {};
  return {
    includeFolders: toStringArray(f["include_folders"]),
    excludeFolders: toStringArray(f["exclude_folders"]),
    includeTags: toStringArray(f["include_tags"]).map(normalizeTag),
    excludeTags: toStringArray(f["exclude_tags"]).map(normalizeTag),
  };
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
    filter: parseFilter(fm),
  };
}
