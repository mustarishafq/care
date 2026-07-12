/**
 * Theme-aware Recharts Tooltip styles.
 * Uses CSS variables so light and dark mode stay readable.
 *
 * Usage:
 *   <Tooltip {...chartTooltipProps} />
 *   <Tooltip {...chartTooltipProps} formatter={...} />
 */
export const chartTooltipContentStyle = {
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '13px',
  lineHeight: 1.4,
  padding: '8px 12px',
  boxShadow: '0 8px 24px hsl(var(--foreground) / 0.12)',
};

export const chartTooltipLabelStyle = {
  color: 'hsl(var(--foreground))',
  fontWeight: 600,
  marginBottom: 4,
};

export const chartTooltipItemStyle = {
  fontSize: '12px',
  color: 'hsl(var(--popover-foreground))',
};

/** Spread onto Recharts <Tooltip /> for theme-safe hover panels */
export const chartTooltipProps = {
  contentStyle: chartTooltipContentStyle,
  labelStyle: chartTooltipLabelStyle,
  itemStyle: chartTooltipItemStyle,
  cursor: { fill: 'hsl(var(--muted) / 0.55)' },
  wrapperStyle: { outline: 'none' },
};
