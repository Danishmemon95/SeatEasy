import type React from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => (
  <AuthLayout>
    <Card className="w-full shadow-sm border-[var(--rule)] flex flex-col gap-5">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
        <Badge variant="neutral">
          <Compass className="w-3.5 h-3.5 mr-1" />
          404
        </Badge>
        <span className="text-caption text-[var(--ink-muted)]">PAGE NOT FOUND</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-normal text-3xl tracking-tight text-[var(--ink)]">
          Nothing scheduled here
        </h1>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
          The page you were looking for doesn't exist or may have moved.
        </p>
      </div>
      <Link
        to="/"
        className="text-caption text-[var(--accent)] link-underline hover:opacity-80 transition-opacity"
      >
        RETURN HOME
      </Link>
    </Card>
  </AuthLayout>
);
