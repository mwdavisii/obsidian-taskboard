import { Column } from "../types";

/**
 * Build the YAML frontmatter (including the surrounding `---` fences) for a new
 * board note. Columns are emitted as flow-style entries that parseBoardConfig
 * accepts; a null tag is emitted as the literal `null`, a string tag is quoted.
 */
export function boardFrontmatter(
  columns: Column[],
  newTaskDestination: string
): string {
  const lines: string[] = ["---", "taskboard: true", "columns:"];
  for (const c of columns) {
    const tag = c.tag === null ? "null" : `"${c.tag}"`;
    lines.push(`  - { name: "${c.name}", tag: ${tag} }`);
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
