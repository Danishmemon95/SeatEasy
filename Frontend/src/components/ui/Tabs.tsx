import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { TabItem } from '../../app/urlState';

export interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Id prefix linking each tab to its panel: panel ids are `${idPrefix}-panel-${tab.id}`. */
  idPrefix: string;
}

/**
 * §9.7: caption labels, a 2px accent indicator that slides between tabs over
 * motion-fast. Arrow keys move between tabs (WAI-ARIA tabs pattern).
 */
export function Tabs<T extends string>({ tabs, active, onChange, idPrefix }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, tabs]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <div ref={listRef} role="tablist" className="relative flex gap-6 border-b border-[var(--rule)] overflow-x-auto">
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`text-caption py-3 shrink-0 cursor-pointer transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 rounded-[4px] ${
              selected ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className="absolute bottom-0 h-0.5 bg-[var(--accent)] transition-[left,width] duration-[200ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  id: string;
  /** Hidden panels stay mounted, so in-progress work in them (e.g. a draft) survives a tab switch. */
  hidden?: boolean;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ idPrefix, id, hidden = false, children }) => (
  <div
    role="tabpanel"
    id={`${idPrefix}-panel-${id}`}
    aria-labelledby={`${idPrefix}-tab-${id}`}
    tabIndex={0}
    hidden={hidden}
    className="outline-none"
  >
    {children}
  </div>
);
