import { TFile, Vault } from "obsidian";
import { Task, Column, Priority } from "../types";
import { parseLine } from "../parser/parseLine";
import { serializeTask } from "../parser/serializeTask";

/**
 * The only unit that writes task lines to disk. Each operation re-reads the
 * target line by line number, re-parses it to confirm identity, applies the
 * change, and writes it back atomically via vault.process.
 *
 * Returns the intended new Task so the view can render optimistically; the
 * subsequent vault modify event will reconcile via the index.
 */
export class TaskMutator {
  constructor(
    private vault: Vault,
    private columns: Column[],
    private checkBoxOnDone: boolean
  ) {}

  private statusTags(): string[] {
    return this.columns
      .map((c) => c.tag)
      .filter((t): t is string => t !== null);
  }

  /** Apply a transform to a single line of a file, writing the result back. */
  private async mutateLine(
    task: Task,
    transform: (parsed: Task) => Task
  ): Promise<Task | null> {
    const file = this.vault.getAbstractFileByPath(task.filePath);
    if (!file) return null;

    let updated: Task | null = null;
    await this.vault.process(file as TFile, (data) => {
      const lines = data.split("\n");
      const current = parseLine(
        lines[task.lineNumber],
        task.filePath,
        task.lineNumber
      );
      // Guard: line must still be a task with the same body (identity check).
      if (!current || current.body !== task.body) return data;
      updated = transform(current);
      lines[task.lineNumber] = serializeTask(updated);
      return lines.join("\n");
    });
    return updated;
  }

  async setStatus(task: Task, column: Column): Promise<Task | null> {
    const statusTags = this.statusTags();
    const isDoneColumn = column.name.toLowerCase() === "done";
    return this.mutateLine(task, (parsed) => {
      // Remove every board status tag, then add the target column's tag.
      const kept = parsed.tags.filter((t) => !statusTags.includes(t));
      const nextTags = column.tag !== null ? [column.tag, ...kept] : kept;

      let checked = parsed.checked;
      if (isDoneColumn && this.checkBoxOnDone) checked = true;
      else if (!isDoneColumn && parsed.checked) checked = false;

      return { ...parsed, tags: nextTags, checked };
    });
  }

  async setDueDate(task: Task, dueDate: string | null): Promise<Task | null> {
    return this.mutateLine(task, (parsed) => ({ ...parsed, dueDate }));
  }

  async setPriority(task: Task, priority: Priority): Promise<Task | null> {
    return this.mutateLine(task, (parsed) => ({ ...parsed, priority }));
  }

  async setText(task: Task, body: string): Promise<Task | null> {
    return this.mutateLine(task, (parsed) => ({ ...parsed, body }));
  }

  /**
   * Append a new task line to a destination file. Creates a `- [ ]` line with
   * the column's status tag (if any). Returns the new line's text.
   */
  async createTask(
    destPath: string,
    body: string,
    column: Column
  ): Promise<string | null> {
    const file = this.vault.getAbstractFileByPath(destPath);
    if (!file) return null;
    const tag = column.tag ? ` ${column.tag}` : "";
    const newLine = `- [ ] ${body}${tag}`;
    await this.vault.process(file as TFile, (data) => {
      const sep = data.length > 0 && !data.endsWith("\n") ? "\n" : "";
      return data + sep + newLine + "\n";
    });
    return newLine;
  }
}
