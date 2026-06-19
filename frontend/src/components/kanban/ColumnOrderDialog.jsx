import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getStatusColors } from '@/lib/ticketUtils';
import { GripVertical, RotateCcw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function ColumnOrderDialog({ open, onOpenChange, columnOrder, defaultOrder, onSave }) {
  const [order, setOrder] = useState(columnOrder);

  const onDragEnd = ({ destination, source }) => {
    if (!destination || destination.index === source.index) return;
    const next = [...order];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    setOrder(next);
  };

  const handleSave = () => {
    onSave(order);
    onOpenChange(false);
  };

  const handleReset = () => setOrder([...defaultOrder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reorder Kanban Columns</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Drag to rearrange the column order.</p>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="column-order">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5 mt-1">
                {order.map((status, index) => {
                  const colors = getStatusColors(status);
                  return (
                    <Draggable key={status} draggableId={status} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            ...(snapshot.isDragging ? { left: 'auto', top: 'auto' } : {}),
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card select-none transition-shadow ${
                            snapshot.isDragging ? 'shadow-lg opacity-90' : 'hover:bg-muted/50 cursor-grab'
                          }`}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                          <span className="text-sm font-medium flex-1">{status}</span>
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="mr-auto">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}