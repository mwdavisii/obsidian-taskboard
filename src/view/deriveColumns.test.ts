import { describe, it, expect } from "vitest";
import { deriveColumns } from "./deriveColumns";
import { Task, Column } from "../types";

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    filePath: partial.filePath ?? "a.md",
    lineNumber: partial.lineNumber ?? 0,
    rawLine: partial.rawLine ?? "- [ ] x",
    checked: partial.checked ?? false,
    body: partial.body ?? "x",
    dueDate: partial.dueDate ?? null,
    priority: partial.priority ?? null,
    tags: partial.tags ?? [],
    trailing: partial.trailing ?? "",
  };
}

const columns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
  { name: "Doing", tag: "#doing" },
  { name: "Done", tag: "#done" },
];

describe("deriveColumns", () => {
  it("places a task in the column matching its status tag", () => {
    const tasks = [task({ tags: ["#doing"], body: "A" })];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Doing"].map((t) => t.body)).toEqual(["A"]);
  });

  it("places an untagged task in the null-tag (Backlog) column", () => {
    const tasks = [task({ tags: [], body: "A" })];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Backlog"].map((t) => t.body)).toEqual(["A"]);
  });

  it("uses the first matching column when a task has multiple status tags", () => {
    const tasks = [task({ tags: ["#done", "#todo"], body: "A" })];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Todo"].map((t) => t.body)).toEqual(["A"]);
  });

  it("sorts by due date (nulls last), then priority, then mtime", () => {
    const tasks = [
      task({ tags: ["#todo"], body: "no-due", dueDate: null }),
      task({ tags: ["#todo"], body: "later", dueDate: "2026-07-01" }),
      task({ tags: ["#todo"], body: "sooner", dueDate: "2026-06-10" }),
    ];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Todo"].map((t) => t.body)).toEqual(["sooner", "later", "no-due"]);
  });

  it("breaks due-date ties by priority (highest first)", () => {
    const tasks = [
      task({ tags: ["#todo"], body: "low", dueDate: "2026-06-10", priority: "low" }),
      task({ tags: ["#todo"], body: "high", dueDate: "2026-06-10", priority: "high" }),
    ];
    const result = deriveColumns(tasks, columns, {});
    expect(result["Todo"].map((t) => t.body)).toEqual(["high", "low"]);
  });
});
