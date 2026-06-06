import { App, PluginSettingTab, Setting } from "obsidian";
import { Column } from "./types";
import type TaskboardPlugin from "./main";

export interface Settings {
  dailyNotesFolder: string;
  newTaskDailyNoteFormat: string;
  excludeFolders: string[];
  excludeFiles: string[];
  excludeTags: string[];
  defaultColumns: Column[];
  checkBoxOnDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyNotesFolder: "00_DailyNotes",
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
