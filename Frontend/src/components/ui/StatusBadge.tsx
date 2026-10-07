import type React from 'react';
import { Badge, type BadgeVariant } from './Badge';
import type { DisplayStatus } from '../../utils/catalogDisplay';
import type { BookingStatus } from '../../types/buyer.types';

const variants: Record<string, BadgeVariant> = {
  draft: 'neutral',
  published: 'success',
  scheduled: 'info',
  cancelled: 'danger',
  past: 'neutral',
  pending: 'warning',
  confirmed: 'success',
};

/** Always text, never colour alone (§13). */
export const StatusBadge: React.FC<{ status: DisplayStatus | BookingStatus; className?: string }> = ({
  status,
  className,
}) => (
  <Badge variant={variants[status] ?? 'neutral'} className={className}>
    {status.toUpperCase()}
  </Badge>
);
