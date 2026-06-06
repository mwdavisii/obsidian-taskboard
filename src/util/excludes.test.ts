import { describe, it, expect } from "vitest";
import { isFileExcluded, isTaskExcluded } from "./excludes";

const settings = {
  excludeFolders: ["Templates", "Archive/**"],
  excludeFiles: ["00_DailyNotes/secret.md"],
  excludeTags: ["#archived", "#private"],
};

describe("isFileExcluded", () => {
  it("excludes a file directly under an excluded folder", () => {
    expect(isFileExcluded("Templates/daily.md", settings)).toBe(true);
  });

  it("excludes a file nested under a globbed folder", () => {
    expect(isFileExcluded("Archive/2025/jan.md", settings)).toBe(true);
  });

  it("excludes an exact file match", () => {
    expect(isFileExcluded("00_DailyNotes/secret.md", settings)).toBe(true);
  });

  it("does not exclude a normal file", () => {
    expect(isFileExcluded("00_DailyNotes/2026/06/06-05-2026.md", settings)).toBe(
      false
    );
  });
});

describe("isTaskExcluded", () => {
  it("excludes a task bearing an excluded tag", () => {
    expect(isTaskExcluded(["#todo", "#archived"], settings)).toBe(true);
  });

  it("keeps a task with no excluded tags", () => {
    expect(isTaskExcluded(["#todo"], settings)).toBe(false);
  });
});
