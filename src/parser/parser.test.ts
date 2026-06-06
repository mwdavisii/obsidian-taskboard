import { describe, it, expect } from "vitest";
import { computeTaskId } from "./taskId";
import { parseLine } from "./parseLine";
import { serializeTask } from "./serializeTask";

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

});

describe("serializeTask", () => {
  const F = "Daily/2026-06-05.md";

  it("serializes a plain unchecked task", () => {
    const t = parseLine("- [ ] Reply to vendor", F, 0)!;
    expect(serializeTask(t)).toBe("- [ ] Reply to vendor");
  });

  it("serializes due date and priority in fixed order", () => {
    const t = parseLine("- [ ] Pay ⏫ 📅 2026-06-30", F, 0)!;
    // Fixed order: body, due, priority, tags, trailing.
    expect(serializeTask(t)).toBe("- [ ] Pay 📅 2026-06-30 ⏫");
  });

  it("emits tags after metadata", () => {
    const t = parseLine("- [ ] Triage #todo", F, 0)!;
    expect(serializeTask(t)).toBe("- [ ] Triage #todo");
  });

  it("preserves indentation on serialize", () => {
    const t = parseLine("    - [ ] Nested", F, 0)!;
    expect(serializeTask(t)).toBe("    - [ ] Nested");
  });
});

describe("html comment goes to trailing", () => {
  const F = "Daily/2026-06-05.md";
  it("splits an html comment out of body into trailing", () => {
    const t = parseLine("- [ ] Reply <!-- mid:ABC123= -->", F, 0)!;
    expect(t.body).toBe("Reply");
    expect(t.trailing).toBe("<!-- mid:ABC123= -->");
  });
});

describe("round-trip", () => {
  const F = "Daily/2026-06-05.md";

  const lines = [
    "- [ ] Reply to vendor",
    "- [x] Done thing",
    "- [ ] Pay invoice 📅 2026-06-30",
    "- [ ] Big task ⏫",
    "- [ ] Triage #todo #project/epic",
    "    - [ ] Nested task",
    "- [ ] Reply <!-- mid:ABC123= -->",
  ];

  for (const line of lines) {
    it(`round-trips: ${line}`, () => {
      const once = parseLine(line, F, 0)!;
      const out = serializeTask(once);
      const twice = parseLine(out, F, 0)!;
      // Semantic equality (ignore lineNumber/rawLine/id which depend on input text).
      expect({
        checked: twice.checked,
        body: twice.body,
        dueDate: twice.dueDate,
        priority: twice.priority,
        tags: twice.tags,
        trailing: twice.trailing,
      }).toEqual({
        checked: once.checked,
        body: once.body,
        dueDate: once.dueDate,
        priority: once.priority,
        tags: once.tags,
        trailing: once.trailing,
      });
    });
  }
});


describe("cleanup.sh interop", () => {
  const F = "00_DailyNotes/2026/06/06-05-2026.md";

  const MID =
    "AAMkADA5YTJiZmRhLWU5YTgtNDQ1Yi05ZGRiLTc0ZjU1MTA4NzcxMwBGAAAAAAH5KJT5AAA=";
  const URL =
    "https://outlook.office365.com/owa/?ItemID=AAMkADA5YTJiZmRhAAH5KJT5AAA%3D&exvsurl=1&viewmodel=ReadMessageItem";

  // The two regexes cleanup.sh uses (Task 4 of cleanup.sh).
  const MID_RE = /- \[x\].*<!-- mid:(\S+) -->/;
  const LINK_RE =
    /- \[x\].*\(https:\/\/outlook\.office365\.com\/owa\/\?ItemID=([^&]+)&/;

  it("a checked task with a mid comment matches cleanup's MID regex", () => {
    const line = `- [ ] Reply to Katie [(open)](${URL}) <!-- mid:${MID} -->`;
    const t = parseLine(line, F, 0)!;
    const done = { ...t, checked: true, tags: ["#done"] };
    const out = serializeTask(done);
    expect(MID_RE.test(out)).toBe(true);
    expect(MID_RE.exec(out)![1]).toBe(MID);
  });

  it("a legacy link-only checked task matches cleanup's LINK regex", () => {
    const line = `- [ ] Reply to AWS [(open)](${URL})`;
    const t = parseLine(line, F, 0)!;
    const done = { ...t, checked: true, tags: ["#done"] };
    const out = serializeTask(done);
    expect(LINK_RE.test(out)).toBe(true);
  });

  it("does not corrupt the outlook url query string", () => {
    const line = `- [ ] Reply [(open)](${URL}) <!-- mid:${MID} -->`;
    const t = parseLine(line, F, 0)!;
    const out = serializeTask({ ...t, checked: true, tags: ["#done"] });
    expect(out).toContain("ItemID=");
    expect(out).toContain("&exvsurl=1");
    expect(out).toContain(`<!-- mid:${MID} -->`);
  });
});
