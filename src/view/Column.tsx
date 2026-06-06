import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Task, Column as ColumnType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAdd: (column: ColumnType, body: string) => void;
  onOpenSource: (task: Task) => void;
  onEditText: (task: Task, body: string) => void;
  onSetDue: (task: Task, due: string | null) => void;
  onCyclePriority: (task: Task) => void;
}

export function Column({
  column,
  tasks,
  onAdd,
  onOpenSource,
  onEditText,
  onSetDue,
  onCyclePriority,
}: ColumnProps) {
  return (
    <div class="tb-column">
      <div class="tb-column-header">
        <span class="tb-column-name">{column.name}</span>
        <span class="tb-column-count">{tasks.length}</span>
        <button
          class="tb-add-btn"
          onClick={() => {
            const body = prompt(`New task in ${column.name}`);
            if (body && body.trim()) onAdd(column, body.trim());
          }}
        >
          +
        </button>
      </div>
      <Droppable droppableId={column.name}>
        {(provided) => (
          <div
            class="tb-column-body"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {tasks.length === 0 && <div class="tb-empty">Drop tasks here</div>}
            {tasks.map((task, i) => (
              <Draggable draggableId={task.id} index={i} key={task.id}>
                {(dp) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const draggableProps = dp.draggableProps as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dragHandleProps = (dp.dragHandleProps ?? {}) as any;
                  return (
                    <div
                      ref={dp.innerRef}
                      {...draggableProps}
                      {...dragHandleProps}
                    >
                      <Card
                        task={task}
                        onOpenSource={onOpenSource}
                        onEditText={onEditText}
                        onSetDue={onSetDue}
                        onCyclePriority={onCyclePriority}
                      />
                    </div>
                  );
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
