import {
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
  debounce,
  Notice,
  normalizePath,
} from "obsidian";
import { Settings, DEFAULT_SETTINGS, TaskboardSettingTab } from "./settings";
import { TaskIndex } from "./index/TaskIndex";
import { BoardView, TASKBOARD_VIEW_TYPE } from "./view/BoardView";
import { isBoardFrontmatter } from "./view/boardConfig";
import { boardFrontmatter, uniqueBoardPath } from "./view/newBoard";

export default class TaskboardPlugin extends Plugin {
  settings!: Settings;
  index!: TaskIndex;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.index = new TaskIndex(this.app.vault, this.settings);

    // Build the index after the layout is ready (vault is fully available).
    this.app.workspace.onLayoutReady(async () => {
      await this.index.scan();
    });

    this.registerView(
      TASKBOARD_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new BoardView(leaf, this.index, this.settings)
    );

    this.registerVaultEvents();
    this.registerCommands();
    this.registerFolderMenu();

    this.addRibbonIcon("kanban-square", "Open taskboard", () => {
      void this.openBoardForActiveFile();
    });

    this.addSettingTab(new TaskboardSettingTab(this.app, this));
  }

  private registerVaultEvents(): void {
    const onModify = debounce(
      (file: TFile) => void this.index.onModify(file),
      150,
      true
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") onModify(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) void this.index.onCreate(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) this.index.onDelete(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) void this.index.onRename(file, oldPath);
      })
    );
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-as-board",
      name: "Open current note as board",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        const isBoard =
          !!file &&
          isBoardFrontmatter(
            this.app.metadataCache.getFileCache(file)?.frontmatter
          );
        if (isBoard && !checking) void this.openBoard(file!);
        return isBoard;
      },
    });

    this.addCommand({
      id: "create-new-board",
      name: "Create new board",
      callback: () => void this.createNewBoard(),
    });
  }

  /** Add a "New taskboard" entry to the file-explorer folder context menu. */
  private registerFolderMenu(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) =>
          item
            .setTitle("New taskboard")
            .setIcon("kanban-square")
            .onClick(() => void this.createNewBoard(file.path))
        );
      })
    );
  }

  /**
   * Create a new auto-named board note and open it. If `targetFolder` is given
   * (e.g. the folder right-clicked in the explorer), the board is created there;
   * otherwise it goes in the configured Boards folder.
   */
  private async createNewBoard(targetFolder?: string): Promise<void> {
    const folder = (targetFolder ?? this.settings.boardsFolder).replace(
      /\/+$/,
      ""
    );
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch {
        // Folder may have been created concurrently; ignore.
      }
    }
    const path = normalizePath(
      uniqueBoardPath(
        folder,
        "Untitled Board",
        (p) => this.app.vault.getAbstractFileByPath(p) !== null
      )
    );
    const name = path.split("/").pop()!.replace(/\.md$/, "");
    const content =
      boardFrontmatter(this.settings.defaultColumns, "daily_note") +
      `\n# ${name}\n`;
    try {
      const file = await this.app.vault.create(path, content);
      await this.openBoard(file);
    } catch (e) {
      new Notice("Failed to create board: " + String(e));
    }
  }

  private async openBoardForActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("Open a note with `taskboard: true` first.");
      return;
    }
    if (
      !isBoardFrontmatter(
        this.app.metadataCache.getFileCache(file)?.frontmatter
      )
    ) {
      new Notice("This note is not a taskboard (add `taskboard: true`).");
      return;
    }
    await this.openBoard(file);
  }

  private async openBoard(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: TASKBOARD_VIEW_TYPE,
      state: { boardFilePath: file.path },
      active: true,
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
