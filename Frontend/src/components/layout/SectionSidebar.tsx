import type React from 'react';
import { NavLink } from 'react-router-dom';

export interface SidebarItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}

export interface SectionSidebarProps {
  sectionTitle: string;
  items: SidebarItem[];
}

export const SectionSidebar: React.FC<SectionSidebarProps> = ({ sectionTitle, items }) => {
  return (
    <>
      {/* Mobile Top Horizontal Scroll Bar (< md) */}
      <div className="flex md:hidden items-center gap-2 p-3 overflow-x-auto border-b border-[var(--rule)] bg-[var(--paper-sunken)] shrink-0 select-none">
        <span className="text-caption text-[var(--ink-muted)] text-[10px] tracking-wider uppercase font-semibold mr-1 shrink-0">
          {sectionTitle}
        </span>
        {items.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="px-3 py-1.5 rounded-[6px] text-xs font-medium text-[var(--ink-muted)] bg-[var(--paper-raised)]/50 opacity-60 flex items-center gap-1.5 shrink-0 cursor-not-allowed"
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-[var(--rule)]">
                    {item.badge}
                  </span>
                )}
              </span>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all ${
                  isActive
                    ? 'bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--rule)] shadow-2xs font-semibold'
                    : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}
      </div>

      {/* Desktop Vertical Sidebar (>= md) */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--rule)] bg-[var(--paper)] min-h-[calc(100vh-3.5rem)] p-4 gap-1 select-none">
        <div className="px-3 py-2 text-caption text-[var(--ink-muted)] text-[10px] tracking-widest uppercase font-semibold">
          {sectionTitle}
        </div>

        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="px-3 py-2 rounded-[6px] text-xs font-medium text-[var(--ink-muted)] opacity-60 flex items-center justify-between cursor-not-allowed"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--paper-sunken)] border border-[var(--rule)] text-[var(--ink-muted)]">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.label}
                to={item.to}
                end
                className={({ isActive }) =>
                  `px-3 py-2 rounded-[6px] text-xs font-medium flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-[var(--paper-sunken)] text-[var(--ink)] font-semibold border-l-2 border-[var(--accent)] pl-2.5'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)]/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)]">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
