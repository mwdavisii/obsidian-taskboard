import { useState, useEffect } from "preact/hooks";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { TaskIndex } from "../index/TaskIndex";
import { TaskMutator } from "../mutator/TaskMutator";
import { BoardConfig, Task, Priority, Column as ColumnType } from "../types";
import { useTaskIndex } from "./hooks";
import { deriveColumns, MtimeMap } from "./deriveColumns";
import { Column } from "./Column";

interface BoardProps {
  index: TaskIndex;
  mutator: TaskMutator;
  config: BoardConfig;
  mtimes: MtimeMap;
  onOpenSource: (task: Task) => void;
  onAdd: (column: ColumnType, body: string) => void;
}

const PRIORITY_CYCLE: Priority[] = [
  null,
  "lowest",
  "low",
  "medium",
  "high",
  "highest",
];

export function Board({
  index,
  mutator,
  config,
  mtimes,
  onOpenSource,
  onAdd,
}: BoardProps) {
  const tasks = useTaskIndex(index);
  // Optimistic placement: {taskId -> columnName} applied until the index catches up.
  const [override, setOverride] = useState<{ id: string; column: string } | null>(
    null
  );

  // Once the index reflects new state, drop the optimistic override.
  useEffect(() => {
    setOverride(null);
  }, [tasks]);

  const grouped = deriveColumns(tasks, config.columns, mtimes);
  if (override) {
    const moved = tasks.find((t) => t.id === override.id);
    if (moved && grouped[override.column]) {
      for (const name of Object.keys(grouped)) {
        grouped[name] = grouped[name].filter((t) => t.id !== override.id);
      }
      grouped[override.column] = [moved, ...grouped[override.column]];
    }
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    // Intra-column drag is a no-op in v1 (sort is automatic).
    if (result.source.droppableId === result.destination.droppableId) return;
    const task = byId.get(result.draggableId);
    if (!task) return;
    const target = config.columns.find(
      (c) => c.name === result.destination!.droppableId
    );
    if (!target) return;
    setOverride({ id: task.id, column: target.name });
    void mutator.setStatus(task, target);
  };

  const onCyclePriority = (task: Task) => {
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    void mutator.setPriority(task, next);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div class="tb-board">
        {config.columns.map((col) => (
          <Column
            key={col.name}
            column={col}
            tasks={grouped[col.name] ?? []}
            onAdd={onAdd}
            onOpenSource={onOpenSource}
            onEditText={(t, body) => void mutator.setText(t, body)}
            onSetDue={(t, due) => void mutator.setDueDate(t, due)}
            onCyclePriority={onCyclePriority}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
