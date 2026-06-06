/**
 * Minimal stub of the `obsidian` package for unit tests.
 * Only the symbols used by production code under test are exported.
 */

export class TFile {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export class TFolder {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

/** Mirrors Obsidian's normalizePath: collapse duplicate slashes, strip leading slash. */
export function normalizePath(path: string): string {
  return path.replace(/\/+/g, "/").replace(/^\//, "");
}

// App is only used in resolveTodayDailyNote (not tested in unit tests).
export class App {}
