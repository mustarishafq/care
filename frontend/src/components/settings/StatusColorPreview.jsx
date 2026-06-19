import { getStatusColorStylesFromHex } from '@/lib/statusColors';

export function StatusBadgePreview({ name, color, className = '' }) {
  const styles = getStatusColorStylesFromHex(color);
  const label = name?.trim() || 'Status name';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 max-w-[160px] ${className}`}
      style={styles.badge}
      title={label}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={styles.dot} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function StatusColumnPreview({ name, color, className = '' }) {
  const styles = getStatusColorStylesFromHex(color);
  const label = name?.trim() || 'Status name';

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-semibold min-w-[120px] max-w-[160px] ${className}`}
      style={styles.badge}
      title={label}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={styles.dot} />
      <span className="truncate">{label}</span>
    </div>
  );
}

export function StatusColorPreviewPanel({ items = [] }) {
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Add statuses to see how colors will appear.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Badges</p>
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <StatusBadgePreview
              key={item.id || `preview-badge-${index}`}
              name={item.name}
              color={item.color}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Kanban columns</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {items.map((item, index) => (
            <StatusColumnPreview
              key={item.id || `preview-column-${index}`}
              name={item.name}
              color={item.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
