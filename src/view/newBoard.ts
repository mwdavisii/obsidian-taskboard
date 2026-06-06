import { Column } from "../types";

/**
 * Build the YAML frontmatter (including the surrounding `---` fences) for a new
 * board note. Columns are emitted as plain strings ("Name" or "Name:#tag") so
 * Obsidian's Properties panel renders them as a valid List(text) property.
 */
export function boardFrontmatter(
  columns: Column[],
  newTaskDestination: string
): string {
  const lines: string[] = ["---", "taskboard: true", "columns:"];
  for (const c of columns) {
    const entry = c.tag === null ? c.name : `${c.name}:${c.tag}`;
    lines.push(`  - "${entry}"`);
  }
  lines.push(`new_task_destination: ${newTaskDestination}`);
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
