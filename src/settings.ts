import { App, PluginSettingTab, Setting } from "obsidian";
import { Column } from "./types";
import type TaskboardPlugin from "./main";

export interface Settings {
  dailyNotesFolder: string;
  boardsFolder: string;
  newTaskDailyNoteFormat: string;
  excludeFolders: string[];
  excludeFiles: string[];
  excludeTags: string[];
  defaultColumns: Column[];
  checkBoxOnDone: boolean;
  /** Max cards rendered per column. Caps drag-and-drop work so big boards stay responsive. */
  maxCardsPerColumn: number;
  /** Folder globs written into new boards' `exclude_folders` so they start narrow. */
  newBoardExcludeFolders: string[];
  /** Tags written into new boards' `exclude_tags` so they start narrow. */
  newBoardExcludeTags: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  dailyNotesFolder: "00_DailyNotes",
  boardsFolder: "Boards",
  newTaskDailyNoteFormat: "MM-DD-YYYY",
  excludeFolders: ["Templates"],
  excludeFiles: [],
  excludeTags: ["#archived"],
  defaultColumns: [
    { name: "Backlog", tag: null },
    { name: "Todo", tag: "#todo" },
    { name: "Doing", tag: "#doing" },
    { name: "Done", tag: "#done" },
  ],
  checkBoxOnDone: true,
  maxCardsPerColumn: 100,
  newBoardExcludeFolders: [],
  newBoardExcludeTags: [],
};

/** Parse a textarea (one entry per line) into a trimmed, non-empty string array. */
function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export class TaskboardSettingTab extends PluginSettingTab {
  plugin: TaskboardPlugin;

  constructor(app: App, plugin: TaskboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Daily notes folder")
      .setDesc("Vault-relative folder where daily notes live.")
      .addText((t) =>
        t.setValue(this.plugin.settings.dailyNotesFolder).onChange(async (v) => {
          this.plugin.settings.dailyNotesFolder = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Boards folder")
      .setDesc("Vault-relative folder where new boards are created.")
      .addText((t) =>
        t.setValue(this.plugin.settings.boardsFolder).onChange(async (v) => {
          this.plugin.settings.boardsFolder = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Daily note filename format")
      .setDesc("Date format for resolving today's note: YYYY, MM, DD tokens.")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.newTaskDailyNoteFormat)
          .onChange(async (v) => {
            this.plugin.settings.newTaskDailyNoteFormat = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("One glob per line (e.g. Templates, Archive/**).")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeFolders.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeFolders = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude files")
      .setDesc("One exact vault-relative path per line.")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeFiles.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeFiles = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude tags")
      .setDesc("One tag per line (e.g. #archived). Tasks with any are hidden.")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeTags.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeTags = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("New board: exclude folders")
      .setDesc(
        "Seeded into a new board's exclude_folders so it starts narrow (e.g. your daily-notes folder). One glob per line."
      )
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.newBoardExcludeFolders.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.newBoardExcludeFolders = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("New board: exclude tags")
      .setDesc(
        "Seeded into a new board's exclude_tags. One tag per line (e.g. #someday)."
      )
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.newBoardExcludeTags.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.newBoardExcludeTags = linesToArray(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max cards per column")
      .setDesc(
        "Cap on cards rendered per column. Keeps large boards responsive; narrow a board with filters to see the rest."
      )
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.maxCardsPerColumn))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            this.plugin.settings.maxCardsPerColumn =
              Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.maxCardsPerColumn;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Check the box on Done")
      .setDesc("When a card moves to a Done column, also mark the task [x].")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.checkBoxOnDone).onChange(async (v) => {
          this.plugin.settings.checkBoxOnDone = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
