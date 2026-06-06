import { describe, it, expect } from "vitest";
import { parseBoardConfig, isBoardFrontmatter } from "./boardConfig";
import { Column } from "../types";

const defaultColumns: Column[] = [
  { name: "Backlog", tag: null },
  { name: "Todo", tag: "#todo" },
];

describe("isBoardFrontmatter", () => {
  it("is true when taskboard is true", () => {
    expect(isBoardFrontmatter({ taskboard: true })).toBe(true);
  });
  it("is false when absent or false", () => {
    expect(isBoardFrontmatter({})).toBe(false);
    expect(isBoardFrontmatter({ taskboard: false })).toBe(false);
    expect(isBoardFrontmatter(null)).toBe(false);
  });
});

describe("parseBoardConfig", () => {
  it("falls back to default columns when none specified", () => {
    const cfg = parseBoardConfig({ taskboard: true }, defaultColumns);
    expect(cfg.columns).toEqual(defaultColumns);
    expect(cfg.newTaskDestination).toBe("daily_note");
  });

  it("reads columns from frontmatter", () => {
    const cfg = parseBoardConfig(
      {
        taskboard: true,
        columns: [
          { name: "To Do", tag: "#todo" },
          { name: "Done", tag: "#done" },
        ],
      },
      defaultColumns
    );
    expect(cfg.columns).toEqual([
      { name: "To Do", tag: "#todo" },
      { name: "Done", tag: "#done" },
    ]);
  });

  it("normalizes a missing tag to null", () => {
    const cfg = parseBoardConfig(
      { taskboard: true, columns: [{ name: "Backlog" }] },
      defaultColumns
    );
    expect(cfg.columns[0]).toEqual({ name: "Backlog", tag: null });
  });

  it("reads new_task_destination", () => {
    const cfg = parseBoardConfig(
      { taskboard: true, new_task_destination: "Inbox.md" },
      defaultColumns
    );
    expect(cfg.newTaskDestination).toBe("Inbox.md");
  });

  it("reads columns from the string form Name:#tag", () => {
    const cfg = parseBoardConfig(
      {
        taskboard: true,
        columns: ["Backlog", "Todo:#todo", "Doing:#doing", "Done:#done"],
      },
      defaultColumns
    );
    expect(cfg.columns).toEqual([
      { name: "Backlog", tag: null },
      { name: "Todo", tag: "#todo" },
      { name: "Doing", tag: "#doing" },
      { name: "Done", tag: "#done" },
    ]);
  });

  it("treats a string with no #tag as a null-tag column", () => {
    const cfg = parseBoardConfig(
      { taskboard: true, columns: ["Backlog"] },
      defaultColumns
    );
    expect(cfg.columns[0]).toEqual({ name: "Backlog", tag: null });
  });

  it("does not split a colon that is not followed by a #tag", () => {
    const cfg = parseBoardConfig(
      { taskboard: true, columns: ["Q3: Planning"] },
      defaultColumns
    );
    expect(cfg.columns[0]).toEqual({ name: "Q3: Planning", tag: null });
  });
});
