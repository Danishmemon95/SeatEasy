import { useEffect } from 'react';

/** Sets the tab title to `${title} · SeatEasy` while the page is mounted. */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · SeatEasy`;
    return () => {
      document.title = previous;
    };
  }, [title]);
};

export const useAppTitle = useDocumentTitle;
