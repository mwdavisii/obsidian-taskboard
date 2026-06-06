import { describe, it, expect } from "vitest";
import { computeTaskId } from "./taskId";
import { parseLine } from "./parseLine";

describe("computeTaskId", () => {
  it("is stable for the same file + body", () => {
    const a = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    const b = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    expect(a).toBe(b);
  });

  it("differs when body differs", () => {
    const a = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    const b = computeTaskId("Daily/2026-06-05.md", "Reply to client");
    expect(a).not.toBe(b);
  });

  it("differs when file differs", () => {
    const a = computeTaskId("Daily/2026-06-05.md", "Reply to vendor");
    const b = computeTaskId("Daily/2026-06-06.md", "Reply to vendor");
    expect(a).not.toBe(b);
  });

  it("returns a hex string", () => {
    const id = computeTaskId("a.md", "x");
    expect(id).toMatch(/^[0-9a-f]+$/);
  });
});

describe("parseLine", () => {
  const F = "Daily/2026-06-05.md";

  it("returns null for non-task lines", () => {
    expect(parseLine("Just a paragraph", F, 0)).toBeNull();
    expect(parseLine("- a bullet, no checkbox", F, 0)).toBeNull();
    expect(parseLine("1. numbered", F, 0)).toBeNull();
  });

  it("parses an unchecked task", () => {
    const t = parseLine("- [ ] Reply to vendor", F, 3)!;
    expect(t).not.toBeNull();
    expect(t.checked).toBe(false);
    expect(t.body).toBe("Reply to vendor");
    expect(t.lineNumber).toBe(3);
    expect(t.filePath).toBe(F);
    expect(t.tags).toEqual([]);
    expect(t.dueDate).toBeNull();
    expect(t.priority).toBeNull();
  });

  it("parses a checked task", () => {
    const t = parseLine("- [x] Done thing", F, 0)!;
    expect(t.checked).toBe(true);
    expect(t.body).toBe("Done thing");
  });

  it("treats [X] uppercase as checked", () => {
    expect(parseLine("- [X] Yep", F, 0)!.checked).toBe(true);
  });

  it("extracts a due date", () => {
    const t = parseLine("- [ ] Pay invoice 📅 2026-06-30", F, 0)!;
    expect(t.dueDate).toBe("2026-06-30");
    expect(t.body).toBe("Pay invoice");
  });

  it("extracts priority", () => {
    expect(parseLine("- [ ] Big task ⏫", F, 0)!.priority).toBe("high");
    expect(parseLine("- [ ] Huge 🔺", F, 0)!.priority).toBe("highest");
    expect(parseLine("- [ ] Small 🔽", F, 0)!.priority).toBe("low");
    expect(parseLine("- [ ] Tiny ⏬", F, 0)!.priority).toBe("lowest");
    expect(parseLine("- [ ] Med 🔼", F, 0)!.priority).toBe("medium");
  });

  it("extracts tags", () => {
    const t = parseLine("- [ ] Triage #todo #project/epic", F, 0)!;
    expect(t.tags).toEqual(["#todo", "#project/epic"]);
    expect(t.body).toBe("Triage");
  });

  it("does NOT treat a url fragment as a tag", () => {
    const t = parseLine("- [ ] See https://example.com/page#section now", F, 0)!;
    expect(t.tags).toEqual([]);
    expect(t.body).toBe("See https://example.com/page#section now");
  });

  it("preserves an outlook open-link inside body", () => {
    const line =
      "- [ ] Reply [(open)](https://outlook.office365.com/owa/?ItemID=AAA%3D&exvsurl=1)";
    const t = parseLine(line, F, 0)!;
    expect(t.body).toContain("[(open)](https://outlook.office365.com/owa/?ItemID=AAA%3D&exvsurl=1)");
    expect(t.tags).toEqual([]);
  });

  it("preserves indentation", () => {
    const t = parseLine("    - [ ] Nested", F, 0)!;
    expect(t.rawLine).toBe("    - [ ] Nested");
    expect(t.body).toBe("Nested");
  });

  it("preserves an html comment (in body until trailing split lands in Task 5)", () => {
    const t = parseLine("- [ ] Reply <!-- mid:ABC123= -->", F, 0)!;
    expect(t.body).toContain("<!-- mid:ABC123= -->");
  });
});
