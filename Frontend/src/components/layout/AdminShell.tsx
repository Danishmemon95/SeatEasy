import type React from 'react';
import { Outlet } from 'react-router-dom';
import { SectionSidebar, type SidebarItem } from './SectionSidebar';
import { FileText, Users, Calendar } from 'lucide-react';

const adminNavItems: SidebarItem[] = [
  {
    label: 'Applications',
    to: '/admin/applications',
    icon: <FileText className="w-4 h-4 text-[var(--accent)]" />,
  },
  {
    label: 'Users',
    to: '/admin/users',
    icon: <Users className="w-4 h-4" />,
    disabled: true,
    badge: 'Soon',
  },
  {
    label: 'Events',
    to: '/admin/events',
    icon: <Calendar className="w-4 h-4" />,
    disabled: true,
    badge: 'Soon',
  },
];

export const AdminShell: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-[calc(100vh-3.5rem)] bg-[var(--paper)]">
      <SectionSidebar sectionTitle="Admin Portal" items={adminNavItems} />
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};
