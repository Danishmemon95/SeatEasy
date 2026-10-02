import type { Screening } from '../../types/catalog.types';
import { istDateKey } from '../../utils/datetime';

export interface ScreeningDay {
  /** IST calendar date, `YYYY-MM-DD`. */
  key: string;
  screenings: Screening[];
}

/** Groups screenings by IST calendar day, keeping the order they came in. */
export const groupByDay = (screenings: Screening[]): ScreeningDay[] => {
  const days: ScreeningDay[] = [];
  for (const s of screenings) {
    const key = istDateKey(s.startsAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.screenings.push(s);
    else days.push({ key, screenings: [s] });
  }
  return days;
};
