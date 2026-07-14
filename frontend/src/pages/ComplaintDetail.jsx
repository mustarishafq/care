import { db } from '@/api/db';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Package, Truck, Clock, Loader2, UserCheck, CornerUpLeft, X, Pencil } from 'lucide-react';
import AssignAgentDialog from '@/components/complaints/AssignAgentDialog';
import EditComplaintDialog from '@/components/complaints/EditComplaintDialog';
import { Link } from 'react-router-dom';
import { format, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/toastApi';
import { buildStatusOrder, buildStatusChangeUpdates, requiresClosureProof, hasClosureProof, CLOSURE_PROOF_REQUIRED_STATUSES } from '@/lib/ticketUtils';
import { useComplaintStatuses } from '@/lib/useLookups';
import { useSlaSettings } from '@/lib/useSlaSettings';
import { useAutoCloseSettings } from '@/lib/useAutoCloseSettings';
import { invalidateNotificationQueries } from '@/lib/notifications';
import { useDepartments } from '@/lib/useDepartments';
import { canViewComplaint } from '@/lib/complaintVisibility';
import { getAssignedAgents } from '@/lib/assignedAgents';
import UserAvatar from '@/components/UserAvatar';
import StatusBadge from '@/components/complaints/StatusBadge';
import PriorityBadge from '@/components/complaints/PriorityBadge';
import StatusProgressBar from '@/components/complaints/StatusProgressBar';
import TicketTimeline from '@/components/complaints/TicketTimeline';
import InternalNotes from '@/components/complaints/InternalNotes';
import ProofImageGallery from '@/components/complaints/ProofImageGallery';
import WhatsappNotifyCard from '@/components/complaints/WhatsappNotifyCard';
import { offerWhatsappShareToast } from '@/lib/whatsappShareToast';
import { getAffectedProducts, groupAffectedProductsByProduct } from '@/lib/whatsappShare';
import ClosureProofEditor from '@/components/complaints/ClosureProofEditor';
import PageContent from '@/components/layout/PageContent';

export default function ComplaintDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const complaintId = window.location.pathname.split('/').pop();
  const { user } = useCurrentUser();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canChangeStatus = hasPermission('complaints.change_status');
  const canAssign = hasPermission('complaints.assign');
  const canEdit = hasPermission('complaints.edit');
  const canAddNotes = hasPermission('complaints.add_notes');
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['complaint', complaintId],
    queryFn: async () => {
      const list = await db.entities.Complaint.filter({ id: complaintId });
      return list[0];
    },
    enabled: !!complaintId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', complaintId],
    queryFn: () => db.entities.TicketActivity.filter({ complaint_id: complaintId }, '-created_date'),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', complaintId],
    queryFn: () => db.entities.InternalNote.filter({ complaint_id: complaintId }, '-created_date'),
  });

  const { data: departments = [] } = useDepartments();
  const { data: complaintStatuses = [] } = useComplaintStatuses();
  const { pausedStatusNames, resolvedStatusNames } = useSlaSettings();
  const { triggerStatusName: autoCloseTriggerStatusName } = useAutoCloseSettings();
  const statusOrder = buildStatusOrder(complaintStatuses, { includeNames: [complaint?.status] });

  const updateComplaint = async (
    updates,
    activityDesc,
    actionType = 'status_changed',
    { whatsappEvent, whatsappOptions } = {},
  ) => {
    setUpdating(true);
    try {
      await db.entities.Complaint.update(complaintId, updates);
      await db.entities.TicketActivity.create({
        complaint_id: complaintId,
        action_type: actionType,
        description: activityDesc,
        user_id: user?.id,
      });

      if (whatsappEvent) {
        const merged = { ...complaint, ...updates };
        offerWhatsappShareToast(merged, { event: whatsappEvent, ...whatsappOptions });
      } else {
        toast.success('Ticket updated');
      }

      queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
      queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
      invalidateNotificationQueries(queryClient);
    } catch (err) {
      toastApiError(err, 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (requiresClosureProof(newStatus) && !hasClosureProof(complaint)) {
      toast.error('Add and save at least one closure proof before closing this ticket.');
      return;
    }

    const updates = buildStatusChangeUpdates(complaint, newStatus, complaintStatuses, new Date(), pausedStatusNames, resolvedStatusNames, autoCloseTriggerStatusName);

    await updateComplaint(
      updates,
      `Status changed from "${complaint.status}" to "${newStatus}"`,
      'status_changed',
      {
        whatsappEvent: 'status_changed',
        whatsappOptions: { oldStatus: complaint.status, newStatus },
      },
    );
  };

  const handleAssignDepartment = async (departmentId) => {
    const dept = departments.find((d) => d.id === departmentId);
    const deptName = dept?.name || 'Unknown';
    await updateComplaint(
      { assigned_department_id: departmentId, assigned_department: deptName },
      `Assigned to ${deptName} department`,
      'assigned',
      { whatsappEvent: 'assigned', whatsappOptions: { note: `Assigned to ${deptName}` } },
    );
  };

  // Department history: derive previous dept from activities
  const prevDept = React.useMemo(() => {
    const deptChanges = activities
      .filter(a => a.action_type === 'assigned' && a.description?.includes('department'))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    // The most recent one is current, the one before is "previous"
    if (deptChanges.length >= 2) {
      const prev = deptChanges[1].description.match(/Assigned to (.+) department/);
      return prev ? prev[1] : null;
    }
    return null;
  }, [activities]);

  if (isLoading || permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!complaint) {
    return <div className="text-center py-16 text-muted-foreground">Ticket not found</div>;
  }

  if (!canViewComplaint(user, complaint)) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="text-muted-foreground">You do not have permission to view this ticket.</p>
        <Link to="/complaints" className="text-primary text-sm hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to complaints
        </Link>
      </div>
    );
  }

  const ageHours = differenceInHours(new Date(), new Date(complaint.created_date));
  const affectedProductGroups = groupAffectedProductsByProduct(getAffectedProducts(complaint));
  const closureLocked = CLOSURE_PROOF_REQUIRED_STATUSES.includes(complaint.status);
  const canManageClosureProof = (canChangeStatus || canEdit) && !closureLocked;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/complaints" className="shrink-0">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold font-mono">{complaint.ticket_id}</h1>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="w-3 h-3" /> {ageHours}h old
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
            Created {format(new Date(complaint.created_date), 'MMM dd, yyyy HH:mm')}
            {complaint.created_by ? ` by ${complaint.created_by}` : ''}
          </p>
        </div>
      </div>

      <PageContent>
      {/* Status Progress */}
      <Card className="rounded-2xl">
        <CardContent className="pt-4 pb-2 overflow-x-auto">
          <StatusProgressBar currentStatus={complaint.status} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Status & Assignment — shown here on mobile/tablet, hidden on lg+ (shown in sidebar there) */}
          <div className="lg:hidden space-y-4 mb-6">
            {canChangeStatus && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Update Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={complaint.status} onValueChange={handleStatusChange} disabled={updating}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOrder.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
            {canAssign && (
              <AssignmentCard
                complaint={complaint}
                departments={departments}
                prevDept={prevDept}
                updating={updating}
                complaintId={complaintId}
                user={user}
                queryClient={queryClient}
                onAssignDepartment={handleAssignDepartment}
                onAssignAgent={() => setAssignOpen(true)}
              />
            )}
            <WhatsappNotifyCard complaint={complaint} event="updated" />
          </div>

          <div className="space-y-6">
          {/* Complaint Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />Customer & Order Info</CardTitle>
                {canEdit && (
                  <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Customer" value={complaint.customer_name} />
                <InfoRow label="Phone" value={complaint.customer_phone} />
                <InfoRow label="Order Number" value={complaint.order_number} />
                <InfoRow label="Order Source" value={complaint.order_source} />
                <InfoRow label="Purchase Date" value={complaint.purchase_date ? format(new Date(`${complaint.purchase_date}T00:00:00`), 'd MMM yyyy') : null} />
                <InfoRow label="Complaint Type" value={complaint.complaint_type} />
              </div>
              {affectedProductGroups.length > 0 && (
                <div className="mt-4 pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Affected Products</p>
                  {affectedProductGroups.map((group, index) => (
                    <div key={`${group.product_id ?? group.product_name}-${index}`} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium">{group.product_name || 'Unknown product'}</p>
                      <div className="space-y-1">
                        {group.lines.map((line, lineIndex) => (
                          <p key={`${line.batch_number}-${lineIndex}`} className="text-sm text-muted-foreground">
                            Batch: {line.batch_number || '—'}
                            {(line.quantity_affected != null || line.unit_of_measurement) && (
                              <span>
                                {' '}— {line.quantity_affected != null ? line.quantity_affected : ''}
                                {line.unit_of_measurement ? ` ${line.unit_of_measurement}` : ''}
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{complaint.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Truck className="w-4 h-4" />Shipping Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Courier" value={complaint.courier_name} />
                <InfoRow label="Original Tracking" value={complaint.tracking_number} />
                <InfoRow label="Replacement Tracking" value={complaint.replacement_tracking_number} />
              </div>
            </CardContent>
          </Card>

          {/* Proof Files */}
          {complaint.proof_files?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" />Proof & Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <ProofImageGallery items={complaint.proof_files} />
              </CardContent>
            </Card>
          )}

          {/* Replacement Tracking + Closure Proof — mobile/tablet only */}
          <div className="lg:hidden space-y-4">
            {canEdit && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Replacement Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrackingForm complaint={complaint} updateComplaint={updateComplaint} updating={updating} />
                </CardContent>
              </Card>
            )}
            {(canManageClosureProof || closureLocked || hasClosureProof(complaint)) && (
              <ClosureProofEditor
                complaint={complaint}
                complaintId={complaintId}
                user={user}
                readOnly={!canManageClosureProof}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
                  queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
                }}
              />
            )}
          </div>

          {/* Tabs: Notes & Timeline */}
          <Tabs defaultValue="notes">
            <TabsList>
              <TabsTrigger value="notes">Internal Notes ({notes.length})</TabsTrigger>
              <TabsTrigger value="timeline">Timeline ({activities.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  <InternalNotes notes={notes} complaintId={complaintId} canAddNotes={canAddNotes} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  <TicketTimeline activities={activities} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          {/* Update Status — hidden on mobile/tablet (shown above tabs there) */}
          {canChangeStatus && (
            <Card className="hidden lg:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={complaint.status} onValueChange={handleStatusChange} disabled={updating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOrder.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {canAssign && (
            <div className="hidden lg:block">
              <AssignmentCard
                complaint={complaint}
                departments={departments}
                prevDept={prevDept}
                updating={updating}
                complaintId={complaintId}
                user={user}
                queryClient={queryClient}
                onAssignDepartment={handleAssignDepartment}
                onAssignAgent={() => setAssignOpen(true)}
              />
            </div>
          )}

          <WhatsappNotifyCard complaint={complaint} event="updated" className="hidden lg:block" />

          {assignOpen && canAssign && (
            <AssignAgentDialog
              complaint={complaint}
              open={assignOpen}
              onClose={() => setAssignOpen(false)}
              onSaved={(updatedComplaint) => {
                queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
                queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
                const target = updatedComplaint ?? complaint;
                offerWhatsappShareToast(target, { event: 'assigned' });
              }}
            />
          )}

          {editOpen && canEdit && (
            <EditComplaintDialog
              complaint={complaint}
              open={editOpen}
              onOpenChange={setEditOpen}
              onSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
                queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
              }}
            />
          )}

          {canEdit && (
            <Card className="hidden lg:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Replacement Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <TrackingForm complaint={complaint} updateComplaint={updateComplaint} updating={updating} />
              </CardContent>
            </Card>
          )}

          {(canManageClosureProof || closureLocked || hasClosureProof(complaint)) && (
            <div className="hidden lg:block">
              <ClosureProofEditor
                complaint={complaint}
                complaintId={complaintId}
                user={user}
                readOnly={!canManageClosureProof}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
                  queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
                }}
              />
            </div>
          )}
        </div>
      </div>
      </PageContent>
    </div>
  );
}

function AssignmentCard({
  complaint,
  departments,
  prevDept,
  updating,
  complaintId,
  user,
  queryClient,
  onAssignDepartment,
  onAssignAgent,
}) {
  const prevDeptRecord = departments.find((d) => d.name === prevDept);
  const assignedAgents = getAssignedAgents(complaint);
  const [removingId, setRemovingId] = useState(null);

  const handleRemoveAgent = async (agent) => {
    setRemovingId(agent.id);
    try {
      await db.complaints.removeAgent(complaintId, agent.id);
      await db.entities.TicketActivity.create({
        complaint_id: complaintId,
        action_type: 'assigned',
        description: `${agent.full_name || agent.email} removed from ticket`,
        user_id: user?.id,
      });
      queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
      queryClient.invalidateQueries({ queryKey: ['activities', complaintId] });
      toast.success('Agent removed');
    } catch {
      toast.error('Failed to remove agent');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Department</Label>
          <Select value={complaint.assigned_department_id || ''} onValueChange={onAssignDepartment} disabled={updating}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {prevDeptRecord && prevDeptRecord.id !== complaint.assigned_department_id && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs w-full border-dashed text-muted-foreground hover:text-foreground"
              disabled={updating}
              onClick={() => onAssignDepartment(prevDeptRecord.id)}
            >
              <CornerUpLeft className="w-3 h-3 mr-1" />
              Return to {prevDeptRecord.name}
            </Button>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Assigned Agents</Label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAssignAgent}>
              <UserCheck className="w-3 h-3 mr-1" />Assign
            </Button>
          </div>
          {assignedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic mt-1">No agents assigned</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {assignedAgents.map((agent) => (
                <Badge key={agent.id} variant="secondary" className="text-xs gap-1.5 pr-1 pl-1 py-1">
                  <UserAvatar
                    user={agent}
                    className="h-5 w-5"
                    fallbackClassName="text-[8px] font-bold bg-primary/10 text-primary"
                  />
                  {agent.full_name || agent.email}
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5 disabled:opacity-50"
                    disabled={removingId === agent.id}
                    onClick={() => handleRemoveAgent(agent)}
                    aria-label={`Remove ${agent.full_name || agent.email}`}
                  >
                    {removingId === agent.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
      <p className="text-sm mt-0.5">{value || '—'}</p>
    </div>
  );
}

function TrackingForm({ complaint, updateComplaint, updating }) {
  const [tracking, setTracking] = useState(complaint.replacement_tracking_number || '');

  const handleSave = () => {
    if (!tracking.trim()) return;
    updateComplaint({ replacement_tracking_number: tracking.trim() }, `Replacement tracking number set to ${tracking.trim()}`, 'tracking_added');
  };

  return (
    <div className="space-y-2">
      <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Enter tracking number" />
      <Button size="sm" onClick={handleSave} disabled={updating || !tracking.trim()} className="w-full">
        {updating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Save Tracking
      </Button>
    </div>
  );
}