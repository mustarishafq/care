import React from 'react';
import { motion } from 'framer-motion';
import { contentSectionMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

export default function AnimatedSection({ children, delay = 0, className }) {
  return (
    <motion.div {...contentSectionMotion(delay)} className={cn(className)}>
      {children}
    </motion.div>
  );
}
