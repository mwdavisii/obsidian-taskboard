import { describe, it, expect } from "vitest";
import { filterTasks, EMPTY_FILTER } from "./boardFilter";
import { BoardFilter, Task } from "../types";

function task(filePath: string, tags: string[]): Task {
  return {
    id: filePath + tags.join(","),
    filePath,
    lineNumber: 0,
    rawLine: "",
    checked: false,
    body: "x",
    dueDate: null,
    priority: null,
    tags,
    trailing: "",
  };
}

function filter(partial: Partial<BoardFilter>): BoardFilter {
  return { ...EMPTY_FILTER, ...partial };
}

const tasks: Task[] = [
  task("Work/a.md", ["#work"]),
  task("Work/Archive/b.md", ["#work", "#done"]),
  task("Personal/c.md", ["#home"]),
  task("Personal/d.md", ["#home", "#someday"]),
];

describe("filterTasks", () => {
  it("returns everything with an empty filter", () => {
    expect(filterTasks(tasks, EMPTY_FILTER)).toHaveLength(4);
  });

  it("includeFolders acts as a whitelist", () => {
    const out = filterTasks(tasks, filter({ includeFolders: ["Work"] }));
    expect(out.map((t) => t.filePath)).toEqual([
      "Work/a.md",
      "Work/Archive/b.md",
    ]);
  });

  it("excludeFolders removes matches, even within an included folder", () => {
    const out = filterTasks(
      tasks,
      filter({ includeFolders: ["Work"], excludeFolders: ["Work/Archive/**"] })
    );
    expect(out.map((t) => t.filePath)).toEqual(["Work/a.md"]);
  });

  it("includeTags acts as a whitelist", () => {
    const out = filterTasks(tasks, filter({ includeTags: ["#home"] }));
    expect(out.map((t) => t.filePath)).toEqual([
      "Personal/c.md",
      "Personal/d.md",
    ]);
  });

  it("excludeTags wins over an include match", () => {
    const out = filterTasks(
      tasks,
      filter({ includeTags: ["#home"], excludeTags: ["#someday"] })
    );
    expect(out.map((t) => t.filePath)).toEqual(["Personal/c.md"]);
  });

  it("requires a task to pass both folder and tag rules", () => {
    const out = filterTasks(
      tasks,
      filter({ includeFolders: ["Work"], includeTags: ["#done"] })
    );
    expect(out.map((t) => t.filePath)).toEqual(["Work/Archive/b.md"]);
  });
});
