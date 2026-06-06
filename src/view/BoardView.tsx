import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";
import { render, h } from "preact";
import { TaskIndex } from "../index/TaskIndex";
import { TaskMutator } from "../mutator/TaskMutator";
import { Settings } from "../settings";
import { Task, Column } from "../types";
import { parseBoardConfig } from "./boardConfig";
import { MtimeMap } from "./deriveColumns";
import { Board } from "./Board";
import { resolveTodayDailyNote } from "../util/dailyNote";

export const TASKBOARD_VIEW_TYPE = "taskboard-view";

/**
 * Obsidian ItemView that renders a board for a specific board note.
 * The board note's path is stored in view state so the view can re-read
 * its frontmatter config.
 */
export class BoardView extends ItemView {
  private boardFilePath: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private index: TaskIndex,
    private settings: Settings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TASKBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.boardFilePath
      ? `Board: ${this.boardFilePath.split("/").pop()}`
      : "Taskboard";
  }

  getIcon(): string {
    return "kanban-square";
  }

  async setState(state: unknown, result: unknown): Promise<void> {
    if (state && typeof state === "object" && "boardFilePath" in state) {
      this.boardFilePath = (state as { boardFilePath: string }).boardFilePath;
    }
    await super.setState(state as never, result as never);
    this.renderBoard();
  }

  getState(): Record<string, unknown> {
    return { boardFilePath: this.boardFilePath };
  }

  async onOpen(): Promise<void> {
    this.renderBoard();
  }

  async onClose(): Promise<void> {
    render(null, this.contentEl);
  }

  /** Build an mtime map from the current loaded files. */
  private buildMtimes(): MtimeMap {
    const map: MtimeMap = {};
    for (const f of this.app.vault.getMarkdownFiles()) {
      map[f.path] = f.stat.mtime;
    }
    return map;
  }

  private renderBoard(): void {
    const container = this.contentEl;
    container.empty();

    const fm =
      this.boardFilePath != null
        ? this.app.metadataCache.getCache(this.boardFilePath)?.frontmatter
        : undefined;
    const config = parseBoardConfig(
      fm as Record<string, unknown> | undefined,
      this.settings.defaultColumns
    );

    const mutator = new TaskMutator(
      this.app.vault,
      config.columns,
      this.settings.checkBoxOnDone
    );

    const onOpenSource = (task: Task) => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (file instanceof TFile) {
        void this.app.workspace
          .getLeaf(false)
          .openFile(file)
          .then(() => {
            const view =
              this.app.workspace.getActiveViewOfType(MarkdownView);
            view?.editor.setCursor({ line: task.lineNumber, ch: 0 });
          });
      }
    };

    const onAdd = async (column: Column, body: string) => {
      let destPath: string | null = null;
      if (config.newTaskDestination === "daily_note") {
        const file = await resolveTodayDailyNote(
          this.app,
          this.settings.dailyNotesFolder,
          this.settings.newTaskDailyNoteFormat,
          new Date()
        );
        destPath = file ? file.path : null;
      } else {
        destPath = config.newTaskDestination;
      }
      if (destPath) await mutator.createTask(destPath, body, column);
    };

    render(
      h(Board, {
        index: this.index,
        mutator,
        config,
        mtimes: this.buildMtimes(),
        onOpenSource,
        onAdd,
      }),
      container
    );
  }
}
