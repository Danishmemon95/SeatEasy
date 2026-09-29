import type React from 'react';
import { Outlet } from 'react-router-dom';
import { SectionSidebar, type SidebarItem } from './SectionSidebar';
import { Sparkles, Calendar, MapPin, BarChart3 } from 'lucide-react';

const organizerNavItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    to: '/organizer/dashboard',
    icon: <Sparkles className="w-4 h-4 text-[var(--accent)]" />,
  },
  {
    label: 'Events',
    to: '/organizer/events',
    icon: <Calendar className="w-4 h-4" />,
    disabled: true,
    badge: 'Soon',
  },
  {
    label: 'Venues',
    to: '/organizer/venues',
    icon: <MapPin className="w-4 h-4" />,
    disabled: true,
    badge: 'Soon',
  },
  {
    label: 'Analytics',
    to: '/organizer/analytics',
    icon: <BarChart3 className="w-4 h-4" />,
    disabled: true,
    badge: 'Soon',
  },
];

export const OrganizerShell: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-[calc(100vh-3.5rem)] bg-[var(--paper)]">
      <SectionSidebar sectionTitle="Organizer Portal" items={organizerNavItems} />
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};
