import { db } from '@/api/db';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/lib/useCurrentUser';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Search, UserCheck, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buildStatusOrder, buildStatusChangeUpdates } from '@/lib/ticketUtils';
import { useComplaintStatuses } from '@/lib/useLookups';
import { notifyAssignedUser, invalidateNotificationQueries } from '@/lib/notifications';
import { getAssignedAgentIds, getAssignedAgents } from '@/lib/assignedAgents';

export default function AssignAgentDialog({ complaint, open, onClose, onSaved }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [newStatus, setNewStatus] = useState(complaint?.status || '');
  const [saving, setSaving] = useState(false);

  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const statusOrder = buildStatusOrder(complaintStatuses, { includeNames: [complaint?.status] });

  const assignedIds = useMemo(() => getAssignedAgentIds(complaint), [complaint]);

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => db.entities.User.list(),
    enabled: open,
  });

  const availableUsers = useMemo(
    () => users.filter((u) => !assignedIds.includes(String(u.id))),
    [users, assignedIds],
  );

  const selectedUsers = useMemo(
    () => availableUsers.filter((u) => selectedIds.includes(String(u.id))),
    [availableUsers, selectedIds],
  );

  const filteredUsers = useMemo(() => {
    const query = agentSearch.trim().toLowerCase();
    if (!query) return availableUsers;
    return availableUsers.filter((u) => {
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [availableUsers, agentSearch]);

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setNewStatus(complaint?.status || '');
      setPickerOpen(false);
      setAgentSearch('');
    }
  }, [open, complaint?.status]);

  const toggleAgent = (userId) => {
    const id = String(userId);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!selectedIds.length) return;
    setSaving(true);

    try {
      for (const agentUserId of selectedIds) {
        await db.complaints.assignAgent(complaint.id, Number(agentUserId));
      }

      if (newStatus && newStatus !== complaint.status) {
        const updates = buildStatusChangeUpdates(complaint, newStatus, complaintStatuses);
        await db.entities.Complaint.update(complaint.id, updates);
      }

      const names = selectedUsers.map((u) => u.full_name || u.email).join(', ');
      await db.entities.TicketActivity.create({
        complaint_id: complaint.id,
        action_type: 'assigned',
        description: `${names} assigned to ticket${newStatus !== complaint.status ? ` and status changed to "${newStatus}"` : ''}`,
        user_id: user?.id,
      });

      for (const agentUserId of selectedIds) {
        if (String(agentUserId) !== String(user?.id)) {
          await notifyAssignedUser({
            assigneeUserId: agentUserId,
            assignerName: user?.full_name,
            ticketId: complaint.ticket_id,
            complaintId: complaint.id,
          });
        }
      }

      invalidateNotificationQueries(queryClient);

      const existingAgents = getAssignedAgents(complaint);
      const addedAgents = selectedUsers.map((u) => ({
        id: String(u.id),
        email: u.email,
        full_name: u.full_name || u.email,
      }));
      const updatedComplaint = {
        ...complaint,
        status: newStatus && newStatus !== complaint.status ? newStatus : complaint.status,
        assigned_agents: [...existingAgents, ...addedAgents],
      };

      onSaved?.(updatedComplaint);
      onClose();
    } catch {
      toast.error('Failed to assign agents');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Assign Agents
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Ticket: <span className="font-mono font-semibold text-foreground">{complaint?.ticket_id}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Select Agents</Label>
            {availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">All agents are already assigned.</p>
            ) : (
              <>
                <Popover
                  open={pickerOpen}
                  onOpenChange={(open) => {
                    setPickerOpen(open);
                    if (!open) setAgentSearch('');
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={pickerOpen}
                      className="w-full justify-between font-normal h-auto min-h-9 py-1.5"
                    >
                      <span className={cn('truncate text-left', !selectedIds.length && 'text-muted-foreground')}>
                        {selectedIds.length
                          ? `${selectedIds.length} agent${selectedIds.length === 1 ? '' : 's'} selected`
                          : 'Select agents...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-2 z-[100]"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={agentSearch}
                        onChange={(e) => setAgentSearch(e.target.value)}
                        placeholder="Search agents..."
                        className="h-9 pl-8"
                      />
                    </div>
                    <div
                      className="max-h-56 overflow-y-auto overscroll-contain space-y-1"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {filteredUsers.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">No agents found.</p>
                      ) : (
                        filteredUsers.map((u) => {
                          const id = String(u.id);
                          const checked = selectedIds.includes(id);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleAgent(id)}
                              />
                              <span className="truncate">{u.full_name || u.email}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedUsers.map((u) => (
                      <Badge key={u.id} variant="secondary" className="text-xs">
                        {u.full_name || u.email}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Update Status (optional)</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                {statusOrder.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selectedIds.length || availableUsers.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Assign{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
