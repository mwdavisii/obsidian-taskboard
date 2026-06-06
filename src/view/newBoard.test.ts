import { describe, it, expect } from "vitest";
import { boardFrontmatter, uniqueBoardPath } from "./newBoard";
import { Column } from "../types";

const columns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
  { name: "Done", tag: "#done" },
];

describe("boardFrontmatter", () => {
  it("emits taskboard:true, columns, and destination", () => {
    const fm = boardFrontmatter(columns, "daily_note");
    expect(fm).toContain("taskboard: true");
    expect(fm).toContain("new_task_destination: daily_note");
    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm.trimEnd().endsWith("---")).toBe(true);
  });

  it("serializes a null tag as a bare string and a string tag as Name:#tag", () => {
    const fm = boardFrontmatter(columns, "daily_note");
    expect(fm).toContain('- "Backlog"');
    expect(fm).toContain('- "Todo:#todo"');
  });

  it("round-trips through parseBoardConfig-compatible YAML shape", () => {
    const fm = boardFrontmatter([{ name: "Doing", tag: "#doing" }], "Inbox.md");
    expect(fm).toContain('- "Doing:#doing"');
    expect(fm).toContain("new_task_destination: Inbox.md");
  });

  it("produces columns that parseBoardConfig reads back identically", async () => {
    const { parseBoardConfig } = await import("./boardConfig");
    const fm = boardFrontmatter(columns, "daily_note");
    // Simulate Obsidian's YAML parse of just the columns list (strings).
    const parsedColumns = columns.map((c) =>
      c.tag === null ? c.name : `${c.name}:${c.tag}`
    );
    const cfg = parseBoardConfig(
      { taskboard: true, columns: parsedColumns, new_task_destination: "daily_note" },
      []
    );
    expect(cfg.columns).toEqual(columns);
    expect(fm).toContain("taskboard: true");
  });
});

describe("uniqueBoardPath", () => {
  it("returns the base path when nothing exists", () => {
    expect(uniqueBoardPath("Boards", "Untitled Board", () => false)).toBe(
      "Boards/Untitled Board.md"
    );
  });

  it("appends a counter when the base path exists", () => {
    const taken = new Set(["Boards/Untitled Board.md"]);
    expect(
      uniqueBoardPath("Boards", "Untitled Board", (p) => taken.has(p))
    ).toBe("Boards/Untitled Board 1.md");
  });

  it("increments until a free name is found", () => {
    const taken = new Set([
      "Boards/Untitled Board.md",
      "Boards/Untitled Board 1.md",
      "Boards/Untitled Board 2.md",
    ]);
    expect(
      uniqueBoardPath("Boards", "Untitled Board", (p) => taken.has(p))
    ).toBe("Boards/Untitled Board 3.md");
  });

  it("strips a trailing slash from the folder", () => {
    expect(uniqueBoardPath("Boards/", "Untitled Board", () => false)).toBe(
      "Boards/Untitled Board.md"
    );
  });
});
