import { describe, it, expect } from "vitest";
import { TaskIndex } from "./TaskIndex";
import { IndexEvent } from "../types";

const settings = {
  excludeFolders: ["Templates"],
  excludeFiles: [],
  excludeTags: ["#archived"],
};

/** Minimal fake of the Vault surface TaskIndex consumes. */
function fakeVault(files: Record<string, string>) {
  return {
    files: { ...files },
    getMarkdownFiles() {
      return Object.keys(this.files).map((path) => ({ path }));
    },
    async read(file: { path: string }) {
      return this.files[file.path] ?? "";
    },
    async cachedRead(file: { path: string }) {
      return this.files[file.path] ?? "";
    },
  };
}

describe("TaskIndex.scan", () => {
  it("indexes tasks from non-excluded files", async () => {
    const vault = fakeVault({
      "a.md": "- [ ] Task A\n- [x] Task B",
      "Templates/t.md": "- [ ] Should be excluded",
    });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    const all = idx.allTasks();
    expect(all.map((t) => t.body).sort()).toEqual(["Task A", "Task B"]);
  });

  it("drops tasks bearing an excluded tag", async () => {
    const vault = fakeVault({ "a.md": "- [ ] Keep\n- [ ] Drop #archived" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    expect(idx.allTasks().map((t) => t.body)).toEqual(["Keep"]);
  });
});

describe("TaskIndex.onModify", () => {
  it("re-parses a file and emits a bulk-changed event", async () => {
    const vault = fakeVault({ "a.md": "- [ ] One" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();

    const events: IndexEvent[] = [];
    idx.on((e) => events.push(e));

    vault.files["a.md"] = "- [ ] One\n- [ ] Two";
    await idx.onModify({ path: "a.md" } as any);

    expect(idx.allTasks().map((t) => t.body).sort()).toEqual(["One", "Two"]);
    expect(events.some((e) => e.type === "bulk-changed")).toBe(true);
  });
});

describe("TaskIndex.onDelete / onRename", () => {
  it("drops tasks for a deleted file", async () => {
    const vault = fakeVault({ "a.md": "- [ ] One", "b.md": "- [ ] Two" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    idx.onDelete({ path: "a.md" } as any);
    expect(idx.allTasks().map((t) => t.body)).toEqual(["Two"]);
  });

  it("moves tasks on rename", async () => {
    const vault = fakeVault({ "a.md": "- [ ] One" });
    const idx = new TaskIndex(vault as any, settings);
    await idx.scan();
    vault.files["b.md"] = vault.files["a.md"];
    delete vault.files["a.md"];
    await idx.onRename({ path: "b.md" } as any, "a.md");
    expect(idx.allTasks()[0].filePath).toBe("b.md");
  });
});
