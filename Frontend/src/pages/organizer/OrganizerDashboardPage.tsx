import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Sparkles,
  Calendar,
  MapPin,
  Ticket,
  PlusCircle,
  UserCheck,
} from 'lucide-react';

export const OrganizerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--rule)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">ORGANIZER DASHBOARD</span>
              <h1 className="font-display font-medium text-2xl text-[var(--ink)]">
                Welcome, {user?.username ?? 'Organizer'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="accent">
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              ORGANIZER ACCESS
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => navigate('/account')}>
              Account Settings
            </Button>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card isInteractive elevation="1" className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)]">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-base text-[var(--ink)]">Create Event</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Set up a new event, assign venues, and configure seating tiers.
              </p>
            </div>
          </Card>

          <Card isInteractive elevation="1" className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--paper-sunken)] text-[var(--ink-secondary)] flex items-center justify-center border border-[var(--rule)]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-base text-[var(--ink)]">Venue Manager</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Design custom seat layouts and manage venue capacities.
              </p>
            </div>
          </Card>

          <Card isInteractive elevation="1" className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--paper-sunken)] text-[var(--ink-secondary)] flex items-center justify-center border border-[var(--rule)]">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-base text-[var(--ink)]">Ticket Analytics</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Track sales revenue, occupancy rates, and attendee check-ins.
              </p>
            </div>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="bg-[var(--paper-sunken)] border-[var(--rule)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <div className="text-xs text-[var(--ink-secondary)]">
              Organizer portal features are enabled for your account. Start creating your first event!
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/apply-for-organization')}>
            View Application
          </Button>
        </Card>
      </div>
    </div>
  );
};
