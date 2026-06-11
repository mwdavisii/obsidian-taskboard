import { describe, it, expect } from "vitest";
import { parseBodySegments } from "./cardBody";

describe("parseBodySegments", () => {
  it("returns a single text segment when there is no link", () => {
    expect(parseBodySegments("just text")).toEqual([
      { type: "text", text: "just text" },
    ]);
  });

  it("splits a markdown link into a link segment carrying label and url", () => {
    const url = "https://outlook.office365.com/owa/?ItemID=AAMkADA5";
    const segs = parseBodySegments(`Reply from Carrie [(open)](${url})`);
    expect(segs).toEqual([
      { type: "text", text: "Reply from Carrie " },
      { type: "link", label: "(open)", url },
    ]);
  });

  it("keeps trailing text after a link", () => {
    const segs = parseBodySegments("a [b](http://x) c");
    expect(segs).toEqual([
      { type: "text", text: "a " },
      { type: "link", label: "b", url: "http://x" },
      { type: "text", text: " c" },
    ]);
  });

  it("handles multiple links in one body", () => {
    const segs = parseBodySegments("[one](http://1) and [two](http://2)");
    expect(segs).toEqual([
      { type: "link", label: "one", url: "http://1" },
      { type: "text", text: " and " },
      { type: "link", label: "two", url: "http://2" },
    ]);
  });

  it("leaves a bare url as plain text (only markdown links are collapsed)", () => {
    expect(parseBodySegments("see http://x.com now")).toEqual([
      { type: "text", text: "see http://x.com now" },
    ]);
  });
});
