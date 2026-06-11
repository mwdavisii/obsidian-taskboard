import {
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
  MarkdownView,
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

  /**
   * Leaves the user has explicitly opened as markdown (via "Edit board note").
   * These are exempt from the auto-convert-to-board behavior, so frontmatter
   * stays editable. WeakSet so entries vanish when a leaf is closed.
   */
  private forceMarkdownLeaves = new WeakSet<WorkspaceLeaf>();

  /** Set while we deliberately open a board note as markdown, to mute auto-convert. */
  private suppressAutoView = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.index = new TaskIndex(this.app.vault, this.settings);

    // Build the index after the layout is ready (vault is fully available).
    this.app.workspace.onLayoutReady(async () => {
      await this.index.scan();
    });

    this.registerView(
      TASKBOARD_VIEW_TYPE,
      (leaf: WorkspaceLeaf) =>
        new BoardView(leaf, this.index, this.settings, this)
    );

    this.registerVaultEvents();
    this.registerCommands();
    this.registerFolderMenu();
    this.registerBoardAutoView();

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
            // Group with the core "New note" / "New folder" creation items
            // instead of dropping into the default section at the bottom.
            .setSection("action-primary")
            .setTitle("New taskboard")
            .setIcon("kanban-square")
            .onClick(() => void this.createNewBoard(file.path))
        );
      })
    );
  }

  /** True if a file is a board note (`taskboard: true` in its frontmatter). */
  private isBoardNote(file: TFile): boolean {
    return isBoardFrontmatter(
      this.app.metadataCache.getFileCache(file)?.frontmatter
    );
  }

  /**
   * Make board notes open as the board view, not raw markdown. A board is a
   * custom ItemView and isn't bound to the `.md` extension, so any path that
   * re-opens the file (back/forward navigation, clicking it in the explorer,
   * a workspace restore) would otherwise land on the markdown view. When such a
   * markdown open is detected for a board note, swap the leaf to the board view
   * — unless the user explicitly asked to edit it as markdown.
   */
  private registerBoardAutoView(): void {
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (this.suppressAutoView) return;
        if (!file || !this.isBoardNote(file)) return;
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.file?.path !== file.path) return;
        if (this.forceMarkdownLeaves.has(view.leaf)) return;
        void view.leaf.setViewState({
          type: TASKBOARD_VIEW_TYPE,
          state: { boardFilePath: file.path },
          active: true,
        });
      })
    );
  }

  /**
   * Open a board note as raw markdown so its frontmatter (columns, filters) can
   * be edited. Opens in source mode so the `---` block is visible even when the
   * user's "Properties in document" display is hidden. Reuses an existing
   * markdown tab for the file if one is open, else a new tab; the leaf is flagged
   * exempt from auto-convert so it stays markdown.
   */
  async openBoardNoteAsMarkdown(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    // Reuse a markdown tab already showing this file, if any.
    let existing: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (
        !existing &&
        leaf.view instanceof MarkdownView &&
        leaf.view.file?.path === filePath
      ) {
        existing = leaf;
      }
    });
    const leaf = existing ?? this.app.workspace.getLeaf("tab");

    // Flag the leaf (survives later re-opens) and mute auto-convert for the
    // synchronous file-open this triggers — belt and suspenders against the race.
    this.forceMarkdownLeaves.add(leaf);
    this.suppressAutoView = true;
    try {
      await leaf.openFile(file, {
        active: true,
        state: { mode: "source", source: true },
      });
    } finally {
      this.suppressAutoView = false;
    }
    void this.app.workspace.revealLeaf(leaf);
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
      boardFrontmatter(this.settings.defaultColumns, "daily_note", {
        excludeFolders: this.settings.newBoardExcludeFolders,
        excludeTags: this.settings.newBoardExcludeTags,
      }) + `\n# ${name}\n`;
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
