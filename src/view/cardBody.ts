export type BodySegment =
  | { type: "text"; text: string }
  | { type: "link"; label: string; url: string };

// Inline markdown link: [label](url). Label has no "]", url no ")".
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Split a task body into plain-text and markdown-link segments for display.
 * Links render as just their (clickable) label, so long URLs don't bloat a card.
 * The underlying `task.body` is untouched — this is display-only.
 */
export function parseBodySegments(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(body)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", text: body.slice(last, m.index) });
    }
    segments.push({ type: "link", label: m[1], url: m[2] });
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    segments.push({ type: "text", text: body.slice(last) });
  }
  return segments;
}
