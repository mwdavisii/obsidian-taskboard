import { Task, Priority } from "../types";

interface CardProps {
  task: Task;
  onOpenSource: (task: Task) => void;
  onEditText: (task: Task, body: string) => void;
  onSetDue: (task: Task, due: string | null) => void;
  onCyclePriority: (task: Task) => void;
}

const PRIORITY_LABEL: Record<Exclude<Priority, null>, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

function dueClass(due: string | null): string {
  if (!due) return "";
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due < todayStr) return "tb-due-overdue";
  if (due === todayStr) return "tb-due-today";
  return "tb-due-upcoming";
}

export function Card({
  task,
  onOpenSource,
  onEditText,
  onSetDue,
  onCyclePriority,
}: CardProps) {
  return (
    <div class="tb-card">
      <div
        class="tb-card-body"
        onClick={() => {
          const next = prompt("Edit task", task.body);
          if (next !== null && next.trim() !== "" && next !== task.body) {
            onEditText(task, next.trim());
          }
        }}
      >
        {task.body}
      </div>
      <div class="tb-card-meta">
        {task.dueDate && (
          <span
            class={`tb-chip ${dueClass(task.dueDate)}`}
            onClick={() => {
              const next = prompt(
                "Due date (YYYY-MM-DD or empty)",
                task.dueDate ?? ""
              );
              if (next !== null)
                onSetDue(task, next.trim() === "" ? null : next.trim());
            }}
          >
            📅 {task.dueDate}
          </span>
        )}
        {task.priority && (
          <span
            class="tb-chip tb-priority"
            onClick={() => onCyclePriority(task)}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        <span
          class="tb-source-link"
          onClick={() => onOpenSource(task)}
          title={task.filePath}
        >
          {task.filePath.split("/").pop()}
        </span>
      </div>
    </div>
  );
}
