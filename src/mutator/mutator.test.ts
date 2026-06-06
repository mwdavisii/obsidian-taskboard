import { describe, it, expect } from "vitest";
import { TaskMutator } from "./TaskMutator";
import { Column, Task } from "../types";
import { parseLine } from "../parser/parseLine";

const columns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
  { name: "Doing", tag: "#doing" },
  { name: "Done", tag: "#done" },
];

function fakeVault(files: Record<string, string>) {
  return {
    files: { ...files },
    getAbstractFileByPath(path: string) {
      return path in this.files ? { path } : null;
    },
    async process(file: { path: string }, fn: (data: string) => string) {
      const next = fn(this.files[file.path]);
      this.files[file.path] = next;
      return next;
    },
    async read(file: { path: string }) {
      return this.files[file.path];
    },
  };
}

function firstTask(content: string, path: string): Task {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = parseLine(lines[i], path, i);
    if (t) return t;
  }
  throw new Error("no task found");
}

describe("TaskMutator.setStatus", () => {
  it("adds a status tag when moving to a tagged column", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[1]); // Todo
    expect(vault.files["a.md"]).toBe("- [ ] Triage #todo");
  });

  it("swaps one status tag for another", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage #todo" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[2]); // Doing
    expect(vault.files["a.md"]).toBe("- [ ] Triage #doing");
  });

  it("removes all board status tags when moving to Backlog (null tag)", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage #doing" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[0]); // Backlog
    expect(vault.files["a.md"]).toBe("- [ ] Triage");
  });

  it("checks the box when moving to Done and checkBoxOnDone is true", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[3]); // Done
    expect(vault.files["a.md"]).toBe("- [x] Triage #done");
  });

  it("unchecks the box when moving out of Done", async () => {
    const vault = fakeVault({ "a.md": "- [x] Triage #done" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[2]); // Doing
    expect(vault.files["a.md"]).toBe("- [ ] Triage #doing");
  });

  it("does not check the box when checkBoxOnDone is false", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, columns, false);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[3]); // Done
    expect(vault.files["a.md"]).toBe("- [ ] Triage #done");
  });

  it("preserves a non-status tag while changing status", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Triage #project/x #todo" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[2]); // Doing
    expect(vault.files["a.md"]).toContain("#project/x");
    expect(vault.files["a.md"]).toContain("#doing");
    expect(vault.files["a.md"]).not.toContain("#todo");
  });

  it("preserves a mid comment through a Done transition (cleanup interop)", async () => {
    const line = "- [ ] Reply <!-- mid:ABC= -->";
    const vault = fakeVault({ "a.md": line });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, columns[3]); // Done
    expect(vault.files["a.md"]).toMatch(/- \[x\].*<!-- mid:ABC= -->/);
  });

  it("checks the box for a renamed Done column carrying the #done tag", async () => {
    const customColumns: Column[] = [
      { name: "Backlog", tag: null },
      { name: "Completed", tag: "#done" },
    ];
    const vault = fakeVault({ "a.md": "- [ ] Triage" });
    const m = new TaskMutator(vault as any, customColumns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setStatus(task, customColumns[1]); // Completed (#done)
    expect(vault.files["a.md"]).toBe("- [x] Triage #done");
  });
});

describe("TaskMutator field edits", () => {
  it("sets a due date", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Pay" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setDueDate(task, "2026-06-30");
    expect(vault.files["a.md"]).toBe("- [ ] Pay 📅 2026-06-30");
  });

  it("sets priority", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Pay" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setPriority(task, "high");
    expect(vault.files["a.md"]).toBe("- [ ] Pay ⏫");
  });

  it("sets body text while preserving metadata", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Old text #todo 📅 2026-06-30" });
    const m = new TaskMutator(vault as any, columns, true);
    const task = firstTask(vault.files["a.md"], "a.md");
    await m.setText(task, "New text");
    expect(vault.files["a.md"]).toContain("New text");
    expect(vault.files["a.md"]).toContain("#todo");
    expect(vault.files["a.md"]).toContain("📅 2026-06-30");
  });
});

describe("TaskMutator.createTask", () => {
  it("appends a new task with the column tag", async () => {
    const vault = fakeVault({ "daily.md": "# Today\n" });
    const m = new TaskMutator(vault as any, columns, true);
    await m.createTask("daily.md", "New thing", columns[1]); // Todo
    expect(vault.files["daily.md"]).toContain("- [ ] New thing #todo");
  });

  it("appends with no tag for the Backlog column", async () => {
    const vault = fakeVault({ "daily.md": "# Today" });
    const m = new TaskMutator(vault as any, columns, true);
    await m.createTask("daily.md", "Untriaged", columns[0]); // Backlog
    expect(vault.files["daily.md"]).toContain("- [ ] Untriaged");
    expect(vault.files["daily.md"]).not.toContain("- [ ] Untriaged #");
  });
});
