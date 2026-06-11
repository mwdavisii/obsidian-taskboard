import { BoardFilter, Column } from "../types";

/** Emit a YAML list property: `key: []` when empty, otherwise a quoted-string list. */
function yamlList(key: string, items: string[]): string {
  if (items.length === 0) return `${key}: []`;
  return [`${key}:`, ...items.map((i) => `  - "${i}"`)].join("\n");
}

/**
 * Build the YAML frontmatter (including the surrounding `---` fences) for a new
 * board note. Columns are emitted as plain strings ("Name" or "Name:#tag") so
 * Obsidian's Properties panel renders them as a valid List(text) property.
 */
export function boardFrontmatter(
  columns: Column[],
  newTaskDestination: string,
  filter?: Partial<BoardFilter>
): string {
  const lines: string[] = ["---", "taskboard: true", "columns:"];
  for (const c of columns) {
    const entry = c.tag === null ? c.name : `${c.name}:${c.tag}`;
    lines.push(`  - "${entry}"`);
  }
  lines.push(`new_task_destination: ${newTaskDestination}`);
  // Seed the filter lists (pre-filled from settings, else empty) so they surface
  // in Obsidian's Properties panel — a board over a big vault should be narrowed
  // here before it renders well.
  lines.push(yamlList("include_folders", filter?.includeFolders ?? []));
  lines.push(yamlList("exclude_folders", filter?.excludeFolders ?? []));
  lines.push(yamlList("include_tags", filter?.includeTags ?? []));
  lines.push(yamlList("exclude_tags", filter?.excludeTags ?? []));
  lines.push("---");
  return lines.join("\n") + "\n";
}

/**
 * Find a free vault-relative path of the form `<folder>/<baseName>.md`,
 * appending ` 1`, ` 2`, ... before the extension until `exists` returns false.
 */
export function uniqueBoardPath(
  folder: string,
  baseName: string,
  exists: (path: string) => boolean
): string {
  const clean = folder.replace(/\/+$/, "");
  const make = (suffix: string) =>
    clean ? `${clean}/${baseName}${suffix}.md` : `${baseName}${suffix}.md`;
  if (!exists(make(""))) return make("");
  let n = 1;
  while (exists(make(` ${n}`))) n++;
  return make(` ${n}`);
}
