import { TFile, Vault } from "obsidian";
import { Task, IndexEvent } from "../types";
import { parseLine } from "../parser/parseLine";
import {
  isFileExcluded,
  isTaskExcluded,
  ExclusionSettings,
} from "../util/excludes";

type Listener = (event: IndexEvent) => void;

/**
 * In-memory index of all tasks in the vault. Owns parsing-on-read and
 * incremental updates from vault events. Does NOT write to disk.
 */
export class TaskIndex {
  private byId = new Map<string, Task>();
  private byFile = new Map<string, string[]>();
  private listeners: Listener[] = [];

  constructor(
    private vault: Vault,
    private settings: ExclusionSettings
  ) {}

  on(listener: Listener): void {
    this.listeners.push(listener);
  }

  private emit(event: IndexEvent): void {
    for (const l of this.listeners) l(event);
  }

  allTasks(): Task[] {
    return Array.from(this.byId.values());
  }

  /** Full scan of the vault. Called once on load. */
  async scan(): Promise<void> {
    this.byId.clear();
    this.byFile.clear();
    for (const file of this.vault.getMarkdownFiles()) {
      if (isFileExcluded(file.path, this.settings)) continue;
      const content = await this.vault.cachedRead(file as TFile);
      this.addFileTasks(file.path, content);
    }
  }

  /** Parse a file's content and insert its tasks (no events emitted). */
  private addFileTasks(filePath: string, content: string): void {
    const ids: string[] = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const task = parseLine(lines[i], filePath, i);
      if (!task) continue;
      if (isTaskExcluded(task.tags, this.settings)) continue;
      this.byId.set(task.id, task);
      ids.push(task.id);
    }
    this.byFile.set(filePath, ids);
  }

  /** Remove all tasks belonging to a file from the index. */
  private dropFile(filePath: string): void {
    const ids = this.byFile.get(filePath) ?? [];
    for (const id of ids) this.byId.delete(id);
    this.byFile.delete(filePath);
  }

  async onModify(file: TFile): Promise<void> {
    this.dropFile(file.path);
    if (!isFileExcluded(file.path, this.settings)) {
      const content = await this.vault.cachedRead(file);
      this.addFileTasks(file.path, content);
    }
    this.emit({ type: "bulk-changed", filePath: file.path });
  }

  async onCreate(file: TFile): Promise<void> {
    if (!file.path.endsWith(".md")) return;
    if (isFileExcluded(file.path, this.settings)) return;
    const content = await this.vault.cachedRead(file);
    this.addFileTasks(file.path, content);
    this.emit({ type: "bulk-changed", filePath: file.path });
  }

  onDelete(file: TFile): void {
    this.dropFile(file.path);
    this.emit({ type: "bulk-changed", filePath: file.path });
  }

  async onRename(file: TFile, oldPath: string): Promise<void> {
    this.dropFile(oldPath);
    if (!isFileExcluded(file.path, this.settings)) {
      const content = await this.vault.cachedRead(file);
      this.addFileTasks(file.path, content);
    }
    this.emit({ type: "bulk-changed", filePath: file.path });
  }
}
