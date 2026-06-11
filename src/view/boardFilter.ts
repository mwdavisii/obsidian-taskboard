import { Task, BoardFilter } from "../types";
import { folderMatchesAny } from "../util/excludes";

/** A filter that hides nothing — used when a board declares no filter keys. */
export const EMPTY_FILTER: BoardFilter = {
  includeFolders: [],
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
};

/** Apply a board's include/exclude filter to the (already globally-filtered) task list. */
export function filterTasks(tasks: Task[], filter: BoardFilter): Task[] {
  return tasks.filter((t) => taskPasses(t, filter));
}

function taskPasses(task: Task, filter: BoardFilter): boolean {
  const { includeFolders, excludeFolders, includeTags, excludeTags } = filter;

  // Folder whitelist: if any are listed, the task's file must match one.
  if (
    includeFolders.length > 0 &&
    !folderMatchesAny(task.filePath, includeFolders)
  )
    return false;
  // Folder blacklist always wins.
  if (excludeFolders.length > 0 && folderMatchesAny(task.filePath, excludeFolders))
    return false;

  // Tag whitelist: if any are listed, the task must carry one.
  if (includeTags.length > 0 && !task.tags.some((t) => includeTags.includes(t)))
    return false;
  // Tag blacklist always wins.
  if (task.tags.some((t) => excludeTags.includes(t))) return false;

  return true;
}
