export interface ExclusionSettings {
  excludeFolders: string[];
  excludeFiles: string[];
  excludeTags: string[];
}

/** Convert a folder glob ("Archive/**" or "Templates") into a RegExp. */
function folderToRegExp(pattern: string): RegExp {
  // Normalize: strip trailing slash.
  const p = pattern.replace(/\/+$/, "");
  // Escape regex specials except our glob marker.
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // "**" matches any depth; a bare folder matches that folder and anything under it.
  const body = escaped.includes("**")
    ? escaped.replace(/\*\*/g, ".*")
    : `${escaped}(/.*)?`;
  return new RegExp(`^${body}$`);
}

export function isFileExcluded(
  filePath: string,
  settings: ExclusionSettings
): boolean {
  if (settings.excludeFiles.includes(filePath)) return true;
  return settings.excludeFolders.some((f) => folderToRegExp(f).test(filePath));
}

export function isTaskExcluded(
  tags: string[],
  settings: ExclusionSettings
): boolean {
  return tags.some((t) => settings.excludeTags.includes(t));
}
