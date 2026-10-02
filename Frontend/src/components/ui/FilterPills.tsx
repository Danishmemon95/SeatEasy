export interface FilterPillOption<T extends string> {
  value: T;
  label: string;
}

export interface FilterPillsProps<T extends string> {
  options: readonly FilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Filter events by status". */
  label: string;
}

/**
 * The segmented filter from AdminApplicationsPage: a sunken track with the
 * active pill raised. Each pill is a toggle button (aria-pressed).
 */
export function FilterPills<T extends string>({ options, value, onChange, label }: FilterPillsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1.5 p-1 bg-[var(--paper-sunken)] rounded-[8px] border border-[var(--rule)] max-w-full overflow-x-auto"
    >
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => !isActive && onChange(o.value)}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-medium whitespace-nowrap transition-all cursor-pointer select-none ${
              isActive
                ? 'bg-[var(--paper-raised)] text-[var(--ink)] shadow-xs border border-[var(--rule)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)] border border-transparent'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
