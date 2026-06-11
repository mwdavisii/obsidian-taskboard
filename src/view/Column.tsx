import { createPortal } from "preact/compat";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Task, Column as ColumnType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  maxCards: number;
  onAdd: (column: ColumnType, body: string) => void;
  onOpenSource: (task: Task) => void;
  onEditText: (task: Task, body: string) => void;
  onSetDue: (task: Task, due: string | null) => void;
  onCyclePriority: (task: Task) => void;
}

export function Column({
  column,
  tasks,
  maxCards,
  onAdd,
  onOpenSource,
  onEditText,
  onSetDue,
  onCyclePriority,
}: ColumnProps) {
  // Render at most `maxCards` draggables — thousands of DnD nodes freeze the UI.
  const visible = tasks.length > maxCards ? tasks.slice(0, maxCards) : tasks;
  const hidden = tasks.length - visible.length;
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
            {visible.map((task, i) => (
              <Draggable draggableId={task.id} index={i} key={task.id}>
                {(dp, snapshot) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const draggableProps = dp.draggableProps as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dragHandleProps = (dp.dragHandleProps ?? {}) as any;
                  const node = (
                    <div
                      ref={dp.innerRef}
                      class="tb-card-draggable"
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
                  // While dragging, render the card into a body-level portal so it
                  // escapes Obsidian's transformed/contained workspace panes — which
                  // otherwise shift and mis-size the position:fixed drag clone.
                  return snapshot.isDragging
                    ? createPortal(node, document.body)
                    : node;
                }}
              </Draggable>
            ))}
            {provided.placeholder}
            {hidden > 0 && (
              <div class="tb-overflow">
                +{hidden} more — narrow this board with filters
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
