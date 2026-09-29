import type React from 'react';
import { Badge, type BadgeVariant } from './Badge';
import type { DisplayStatus } from '../../utils/catalogDisplay';

const variants: Record<DisplayStatus, BadgeVariant> = {
  draft: 'neutral',
  published: 'success',
  scheduled: 'info',
  cancelled: 'danger',
  past: 'neutral',
};

/** Always text, never colour alone (§13). */
export const StatusBadge: React.FC<{ status: DisplayStatus; className?: string }> = ({ status, className }) => (
  <Badge variant={variants[status]} className={className}>
    {status.toUpperCase()}
  </Badge>
);
