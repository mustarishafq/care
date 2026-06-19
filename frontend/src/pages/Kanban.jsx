import { db } from '@/api/db';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { STATUS_COLORS, buildStatusChangeUpdates, buildStatusOrder } from '@/lib/ticketUtils';
import { filterVisibleComplaints } from '@/lib/complaintVisibility';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PriorityBadge from '@/components/complaints/PriorityBadge';
import SlaTimer from '@/components/complaints/SlaTimer';
import ColumnOrderDialog from '@/components/kanban/ColumnOrderDialog';
import { format } from 'date-fns';
import { Clock, ArrowUpDown, Columns } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { buildPriorityOrder, useComplaintStatuses, usePriorities } from '@/lib/useLookups';
import { toast } from 'sonner';
import { invalidateNotificationQueries } from '@/lib/notifications';

const STORAGE_KEY = 'kanban_column_order';

function loadColumnOrder(statusOrder, existing = []) {
  const activeNames = new Set(statusOrder);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved).filter((s) => activeNames.has(s));
      const missing = statusOrder.filter((s) => !parsed.includes(s));
      return [...parsed, ...missing];
    }
  } catch {}
  if (existing.length) {
    const kept = existing.filter((s) => activeNames.has(s));
    const missing = statusOrder.filter((s) => !kept.includes(s));
    return [...kept, ...missing];
  }
  return [...statusOrder];
}

function sortCards(cards, sortBy, priorityOrderMap = {}) {
  const sorted = [...cards];
  if (sortBy === 'date_asc') return sorted.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  if (sortBy === 'date_desc') return sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  if (sortBy === 'priority') {
    return sorted.sort((a, b) => (priorityOrderMap[a.priority_id] ?? 99) - (priorityOrderMap[b.priority_id] ?? 99));
  }
  if (sortBy === 'customer') return sorted.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''));
  return sorted;
}

export default function Kanban() {
  const { user, isAdmin } = useCurrentUser();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canChangeStatus = hasPermission('complaints.change_status');
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState(null);
  const [columnSorts, setColumnSorts] = useState({});
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const [columnOrder, setColumnOrder] = useState([]);
  const [columnOrderOpen, setColumnOrderOpen] = useState(false);

  const saveColumnOrder = (order) => {
    setColumnOrder(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  };

  const { data: priorities = [] } = usePriorities();
  const priorityOrder = buildPriorityOrder(priorities);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => db.entities.Complaint.list('-created_date', 500),
  });

  const visibleComplaints = filterVisibleComplaints(user, complaints);

  const statusOrder = React.useMemo(() => {
    const inUseStatuses = [...new Set(visibleComplaints.map((c) => c.status).filter(Boolean))];
    return buildStatusOrder(complaintStatuses, { includeNames: inUseStatuses });
  }, [complaintStatuses, visibleComplaints]);

  React.useEffect(() => {
    if (!statusOrder.length) return;
    setColumnOrder((prev) => (prev.length ? loadColumnOrder(statusOrder, prev) : loadColumnOrder(statusOrder)));
  }, [statusOrder.join('|')]);

  const onDragEnd = async (result) => {
    if (!canChangeStatus) return;
    setDraggingId(null);
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId;
    const complaint = complaints.find(c => c.id === draggableId);
    if (!complaint) return;

    const updates = buildStatusChangeUpdates(complaint, newStatus, complaintStatuses);

    const previousComplaints = queryClient.getQueryData(['complaints']);
    queryClient.setQueryData(['complaints'], (old = []) =>
      old.map(c => c.id === draggableId ? { ...c, ...updates } : c)
    );

    try {
      await db.entities.Complaint.update(draggableId, updates);
      await db.entities.TicketActivity.create({
        complaint_id: draggableId,
        action_type: 'status_changed',
        description: `Status changed from "${complaint.status}" to "${newStatus}" via Kanban`,
        user_id: user?.id,
      });

      invalidateNotificationQueries(queryClient);
      toast.success(`Moved to "${newStatus}"`);
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    } catch {
      if (previousComplaints !== undefined) {
        queryClient.setQueryData(['complaints'], previousComplaints);
      }
      toast.error('Failed to update status');
    }
  };

  if (isLoading || !user || permLoading) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-44 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-56 bg-muted animate-pulse rounded-md" />
          </div>
          <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, col) => (
            <div key={col} className="shrink-0 w-[270px]">
              <div className="h-9 bg-muted animate-pulse rounded-t-lg" />
              <div className="border border-t-0 border-border rounded-b-lg p-2 space-y-2 min-h-[120px] bg-muted/20">
                {[...Array(col % 2 === 0 ? 3 : 2)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2 animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <div className="h-4 w-12 bg-muted rounded-full" />
                    </div>
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="pt-2 border-t border-border flex justify-between">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-3 w-14 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kanban Board</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {canChangeStatus ? 'Drag & drop tickets to update status' : 'View-only board — you cannot change ticket status'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setColumnOrderOpen(true)} className="self-start sm:self-auto">
            <Columns className="w-4 h-4 mr-2" />Edit Column Order
          </Button>
        )}
      </div>

      <ColumnOrderDialog
        open={columnOrderOpen}
        onOpenChange={setColumnOrderOpen}
        columnOrder={columnOrder}
        defaultOrder={statusOrder}
        onSave={saveColumnOrder}
      />

      <DragDropContext onDragEnd={onDragEnd} onDragStart={r => setDraggingId(r.draggableId)}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnOrder.map(status => {
            const rawCards = visibleComplaints.filter(c => c.status === status);
            const sortBy = columnSorts[status] || 'date_desc';
            const cards = sortCards(rawCards, sortBy, priorityOrder);
            const colors = STATUS_COLORS[status];
            return (
              <div key={status} className="shrink-0 w-[270px]">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${colors.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className={`text-xs font-semibold ${colors.text}`}>{status}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5">{cards.length}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 shrink-0 opacity-60 hover:opacity-100">
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuRadioGroup value={sortBy} onValueChange={v => setColumnSorts(prev => ({ ...prev, [status]: v }))}>
                        <DropdownMenuRadioItem value="date_desc">Newest first</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="date_asc">Oldest first</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="priority">By priority</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="customer">By customer</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`border border-t-0 border-border rounded-b-lg p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto transition-colors ${
                        snapshot.isDraggingOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                      }`}
                    >
                      {cards.map((c, index) => (
                        <Draggable key={c.id} draggableId={c.id} index={index} isDragDisabled={!canChangeStatus}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...(canChangeStatus ? provided.dragHandleProps : {})}
                              className={`bg-card border border-border rounded-lg p-3 transition-shadow select-none ${
                                snapshot.isDragging ? 'shadow-xl rotate-1 opacity-90' : canChangeStatus ? 'hover:shadow-md cursor-grab active:cursor-grabbing' : 'hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Link
                                  to={`/complaints/${c.id}`}
                                  onClick={e => e.stopPropagation()}
                                  className="font-mono text-xs font-semibold text-primary hover:underline"
                                >
                                  {c.ticket_id}
                                </Link>
                                <PriorityBadge priority={c.priority} />
                              </div>
                              <p className="text-sm font-medium truncate">{c.customer_name}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.product_name}</p>
                              <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">{c.complaint_type}</span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(c.created_date), 'MMM dd')}
                                  </span>
                                </div>
                                <SlaTimer complaint={c} />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {cards.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-xs text-muted-foreground text-center py-8">No tickets</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}