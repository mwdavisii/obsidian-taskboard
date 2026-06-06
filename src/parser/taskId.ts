/**
 * Stable id for a task: a hash of filePath + body.
 * Independent of line number so the id survives edits to surrounding lines.
 * Uses a simple FNV-1a 32-bit hash — no crypto dependency needed.
 */
export function computeTaskId(filePath: string, body: string): string {
  const input = filePath + " " + body;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 forces unsigned 32-bit before hex.
  return (hash >>> 0).toString(16).padStart(8, "0");
}
