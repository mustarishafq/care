import {
  AlertTriangle,
  AtSign,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Megaphone,
  Package,
  RefreshCw,
  Shield,
  UserPlus,
  Wallet,
} from 'lucide-react';

const TYPE_META = {
  ticket_assigned: { severity: 'info', category: 'task', priority: 'medium', icon: UserPlus },
  department_assigned: { severity: 'info', category: 'task', priority: 'medium', icon: Building2 },
  status_changed: { severity: 'info', category: 'task', priority: 'medium', icon: RefreshCw },
  mention: { severity: 'info', category: 'task', priority: 'medium', icon: AtSign },
  sla_warning: { severity: 'warning', category: 'system', priority: 'high', icon: AlertTriangle },
  low_rating_review: { severity: 'warning', category: 'system', priority: 'high', icon: AlertTriangle },
  overdue: { severity: 'critical', category: 'system', priority: 'critical', icon: Clock },
  approval: { severity: 'info', category: 'approval', priority: 'medium', icon: CheckCircle2 },
  announcement: { severity: 'info', category: 'announcement', priority: 'medium', icon: Megaphone },
  general: { severity: 'info', category: 'other', priority: 'medium', icon: Bell },
};

const CATEGORY_LABELS = {
  booking: 'Booking',
  hr: 'HR',
  inventory: 'Inventory',
  finance: 'Finance',
  security: 'Security',
  system: 'System',
  task: 'Task',
  approval: 'Approval',
  announcement: 'Announcement',
  calendar: 'Calendar',
  other: 'Other',
};

const CATEGORY_ICONS = {
  booking: Calendar,
  hr: UserPlus,
  inventory: Package,
  finance: Wallet,
  security: Shield,
  system: AlertTriangle,
  task: FileText,
  approval: CheckCircle2,
  announcement: Megaphone,
  calendar: Calendar,
  other: Bell,
};

const TYPE_VISUALS = {
  info: {
    color: 'text-info',
    bg: 'bg-info/10',
    border: 'border-info/45 dark:border-info/30',
    dot: 'bg-info',
  },
  success: {
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/45 dark:border-success/30',
    dot: 'bg-success',
  },
  warning: {
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/50 dark:border-warning/35',
    dot: 'bg-warning',
  },
  error: {
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/45 dark:border-destructive/30',
    dot: 'bg-destructive',
  },
  critical: {
    color: 'text-critical',
    bg: 'bg-critical/10',
    border: 'border-critical/45 dark:border-critical/30',
    dot: 'bg-critical',
  },
};

const PRIORITY_VISUALS = {
  low: {
    light: 'text-foreground/70 bg-muted',
    dark: 'text-muted-foreground bg-muted',
  },
  medium: {
    light: 'text-white bg-info',
    dark: 'text-white bg-info',
  },
  high: {
    light: 'text-white bg-warning',
    dark: 'text-warning bg-warning/25 border border-warning/40',
  },
  critical: {
    light: 'text-white bg-critical',
    dark: 'text-critical bg-critical/25 border border-critical/40',
  },
};

export function normalizeNotification(notification) {
  const meta = TYPE_META[notification?.type] ?? TYPE_META.general;

  return {
    ...notification,
    severity: notification.severity ?? meta.severity,
    category: notification.category ?? meta.category,
    priority: notification.priority ?? meta.priority,
    is_read: Boolean(notification.is_read),
    action_url: notification.action_url
      ?? (notification.complaint_id ? `/complaints/${notification.complaint_id}` : null),
    created_at: notification.created_at ?? notification.created_date,
    system_id: notification.system_id ?? 'care',
  };
}

export function getNotificationTypeVisual(severity = 'info') {
  return TYPE_VISUALS[severity] ?? TYPE_VISUALS.info;
}

export function getNotificationPriorityVisual(priority = 'medium', isDark = false) {
  const visual = PRIORITY_VISUALS[priority] ?? PRIORITY_VISUALS.medium;
  return isDark ? visual.dark : visual.light;
}

export function getNotificationCategoryLabel(category = 'other') {
  return CATEGORY_LABELS[category] ?? category;
}

export function getNotificationCategoryIcon(category = 'other') {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
}

export function getNotificationTypeIcon(type = 'general') {
  return (TYPE_META[type] ?? TYPE_META.general).icon;
}

export function isCriticalNotification(notification) {
  const normalized = normalizeNotification(notification);
  return normalized.severity === 'critical'
    || normalized.severity === 'error'
    || normalized.priority === 'critical'
    || normalized.type === 'overdue';
}
