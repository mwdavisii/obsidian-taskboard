import { useEffect, useState } from "preact/hooks";
import { TaskIndex } from "../index/TaskIndex";
import { Task } from "../types";

/**
 * Subscribe to a TaskIndex and re-render on any index event.
 * Returns the current full task list (debounced at 50ms to batch bursts).
 */
export function useTaskIndex(index: TaskIndex): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() => index.allTasks());

  useEffect(() => {
    let timer: number | null = null;
    const refresh = () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        setTasks(index.allTasks());
      }, 50);
    };
    index.on(refresh);
    refresh();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [index]);

  return tasks;
}
