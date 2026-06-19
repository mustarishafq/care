import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
        className,
      )}
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </motion.div>
  );
}
