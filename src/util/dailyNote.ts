import { App, TFile, normalizePath } from "obsidian";

/** Format a date with a tiny subset of moment tokens: YYYY, MM, DD. */
function formatDate(format: string, date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return format.replace("YYYY", yyyy).replace("MM", mm).replace("DD", dd);
}

/** Build the vault-relative path of the daily note for a given date. */
export function dailyNotePath(
  folder: string,
  format: string,
  date: Date
): string {
  const cleanFolder = folder.replace(/\/+$/, "");
  return `${cleanFolder}/${formatDate(format, date)}.md`;
}

/**
 * Resolve today's daily note, creating an empty file if it doesn't exist.
 * Returns the TFile, or null if creation failed.
 */
export async function resolveTodayDailyNote(
  app: App,
  folder: string,
  format: string,
  date: Date
): Promise<TFile | null> {
  const path = normalizePath(dailyNotePath(folder, format, date));
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  // Ensure the folder exists.
  const folderPath = normalizePath(folder.replace(/\/+$/, ""));
  if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
    try {
      await app.vault.createFolder(folderPath);
    } catch {
      // Folder may have been created concurrently; ignore.
    }
  }

  try {
    return await app.vault.create(path, "");
  } catch {
    return null;
  }
}
