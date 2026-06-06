import { describe, it, expect } from "vitest";
import { dailyNotePath } from "./dailyNote";

describe("dailyNotePath", () => {
  const date = new Date(2026, 5, 5); // 2026-06-05 (month is 0-based)

  it("formats MM-DD-YYYY under the folder", () => {
    expect(dailyNotePath("00_DailyNotes", "MM-DD-YYYY", date)).toBe(
      "00_DailyNotes/06-05-2026.md"
    );
  });

  it("formats YYYY-MM-DD", () => {
    expect(dailyNotePath("Journal", "YYYY-MM-DD", date)).toBe(
      "Journal/2026-06-05.md"
    );
  });

  it("handles a trailing slash on the folder", () => {
    expect(dailyNotePath("Journal/", "YYYY-MM-DD", date)).toBe(
      "Journal/2026-06-05.md"
    );
  });

  it("handles compact YYYYMMDD format", () => {
    expect(dailyNotePath("J", "YYYYMMDD", date)).toBe("J/20260605.md");
  });
});
