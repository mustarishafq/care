import { db } from '@/api/db';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/lib/useCurrentUser';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { buildStatusOrder, buildStatusChangeUpdates } from '@/lib/ticketUtils';
import { useComplaintStatuses } from '@/lib/useLookups';
import { notifyAssignedUser, notifyStatusChange, invalidateNotificationQueries } from '@/lib/notifications';

export default function AssignAgentDialog({ complaint, open, onClose, onSaved }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [agentUserId, setAgentUserId] = useState(complaint?.assigned_user_id || '');
  const [newStatus, setNewStatus] = useState(complaint?.status || '');
  const [saving, setSaving] = useState(false);

  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const statusOrder = buildStatusOrder(complaintStatuses);

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => db.entities.User.list(),
    enabled: open,
  });

  const handleSave = async () => {
    if (!agentUserId) return;
    setSaving(true);
    const selectedUser = users.find(u => String(u.id) === String(agentUserId));
    const updates = {
      assigned_user_id: agentUserId,
    };
    if (newStatus && newStatus !== complaint.status) {
      Object.assign(updates, buildStatusChangeUpdates(complaint, newStatus, complaintStatuses));
    }

    await db.entities.Complaint.update(complaint.id, updates);
    await db.entities.TicketActivity.create({
      complaint_id: complaint.id,
      action_type: 'assigned',
      description: `Ticket reassigned to ${selectedUser?.full_name || selectedUser?.email}${newStatus !== complaint.status ? ` and status changed to "${newStatus}"` : ''}`,
      user_id: user?.id,
    });

    const assigneeChanged = String(agentUserId) !== String(complaint.assigned_user_id);

    if (assigneeChanged && String(agentUserId) !== String(user?.id)) {
      await notifyAssignedUser({
        assigneeUserId: agentUserId,
        assignerName: user?.full_name,
        ticketId: complaint.ticket_id,
        complaintId: complaint.id,
      });
    } else if (newStatus && newStatus !== complaint.status && String(agentUserId) !== String(user?.id)) {
      await notifyStatusChange({
        recipientUserId: agentUserId,
        changerName: user?.full_name,
        ticketId: complaint.ticket_id,
        oldStatus: complaint.status,
        newStatus,
        complaintId: complaint.id,
      });
    }

    invalidateNotificationQueries(queryClient);

    toast.success('Ticket reassigned successfully');
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Reassign Ticket
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Ticket: <span className="font-mono font-semibold text-foreground">{complaint?.ticket_id}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Assign to Agent</Label>
            <Select value={String(agentUserId || '')} onValueChange={setAgentUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Update Status (optional)</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                {statusOrder.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !agentUserId}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
