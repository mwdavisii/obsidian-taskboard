import { describe, it, expect } from "vitest";
import { computeTaskId } from "./taskId";

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
