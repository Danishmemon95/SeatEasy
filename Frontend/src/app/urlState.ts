/*
 * Page state that lives in the URL (?tab=, ?page=) so it survives refresh and
 * can be shared as a link (plan §7).
 */
import { useSearchParams } from 'react-router-dom';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

/**
 * The active tab lives in the URL (`?tab=details`) so it survives refresh and
 * can be linked to. An unknown or missing value falls back to the first tab.
 */
export const useTabParam = <T extends string>(tabs: readonly TabItem<T>[], param = 'tab') => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const active = (tabs.find((t) => t.id === raw)?.id ?? tabs[0].id) as T;

  const setActive = (id: T) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === tabs[0].id) next.delete(param);
        else next.set(param, id);
        return next;
      },
      { replace: true },
    );
  };

  return [active, setActive] as const;
};

/** The current `?page=` (1 when missing or invalid) and a setter that keeps the other params. */
export const usePageParam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = Number(searchParams.get('page'));
  const page = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  const setPage = (next: number) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next <= 1) params.delete('page');
      else params.set('page', String(next));
      return params;
    });
  };

  return [page, setPage] as const;
};
