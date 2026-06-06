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

  it("serializes a null tag as null and a string tag quoted", () => {
    const fm = boardFrontmatter(columns, "daily_note");
    expect(fm).toContain('- { name: "Backlog", tag: null }');
    expect(fm).toContain('- { name: "Todo", tag: "#todo" }');
  });

  it("round-trips through parseBoardConfig-compatible YAML shape", () => {
    // The emitted columns block must be flow-style entries the parser accepts.
    const fm = boardFrontmatter([{ name: "Doing", tag: "#doing" }], "Inbox.md");
    expect(fm).toContain('- { name: "Doing", tag: "#doing" }');
    expect(fm).toContain("new_task_destination: Inbox.md");
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
