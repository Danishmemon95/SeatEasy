import type React from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ShieldAlert } from 'lucide-react';

/** Shown when an authenticated user hits a route their role does not allow. */
export const ForbiddenPage: React.FC = () => (
  <AuthLayout>
    <Card className="w-full shadow-sm border-[var(--rule)] flex flex-col gap-5">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
        <Badge variant="danger">
          <ShieldAlert className="w-3.5 h-3.5 mr-1" />
          403
        </Badge>
        <span className="text-caption text-[var(--ink-muted)]">ACCESS RESTRICTED</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-normal text-3xl tracking-tight text-[var(--ink)]">
          Not your section
        </h1>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
          Your account doesn't have permission to view this page.
        </p>
      </div>
      <Link
        to="/account"
        className="text-caption text-[var(--accent)] link-underline hover:opacity-80 transition-opacity"
      >
        BACK TO YOUR ACCOUNT
      </Link>
    </Card>
  </AuthLayout>
);
