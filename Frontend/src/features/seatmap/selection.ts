/*
 * The buyer's seat selection for one screening, kept in sessionStorage so it
 * survives the login redirect and a refresh (plan §4.3). Checkout also writes
 * it when a hold expires, so "Choose seats again" comes back pre-selected.
 */

const selectionKey = (screeningId: number) => `seatease:selection:${screeningId}`;

export const loadSelection = (screeningId: number): number[] => {
  try {
    const raw = sessionStorage.getItem(selectionKey(screeningId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
};

export const saveSelection = (screeningId: number, ids: number[]) => {
  try {
    sessionStorage.setItem(selectionKey(screeningId), JSON.stringify(ids));
  } catch {
    /* storage blocked: the selection just won't survive a reload */
  }
};

export const clearSelection = (screeningId: number) => {
  try {
    sessionStorage.removeItem(selectionKey(screeningId));
  } catch {
    /* ignore */
  }
};
