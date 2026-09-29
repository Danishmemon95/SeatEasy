/*
 * Time and money formatting for the organizer catalog.
 *
 * Every venue is in India, so the UI works in IST (Asia/Kolkata) regardless of
 * the browser's zone. The API stores UTC and requires an explicit offset on
 * input, so times go out as `YYYY-MM-DDTHH:mm:00+05:30`.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Mirrors MIN_LEAD_HOURS / MAX_DAYS_AHEAD in the backend screening schema. */
export const MIN_LEAD_HOURS = 24;
export const MAX_DAYS_AHEAD = 180;
export const SCREENING_BUFFER_MINUTES = 15;

/** `('2026-10-12', '19:30')` → `2026-10-12T19:30:00+05:30`. */
export const toApiDateTime = (date: string, time: string): string =>
  `${date}T${time}:00${IST_OFFSET}`;

const istParts = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};

/** An ISO timestamp as IST `{ date: 'YYYY-MM-DD', time: 'HH:mm' }`, to prefill form inputs. */
export const splitForForm = (iso: string): { date: string; time: string } => istParts(new Date(iso));

/** Earliest bookable start date (now + 24 h) as an IST `YYYY-MM-DD`, for `<input type="date" min>`. */
export const minStartDate = (now = new Date()): string =>
  istParts(new Date(now.getTime() + MIN_LEAD_HOURS * HOUR_MS)).date;

/** Latest bookable start date (now + 180 d) as an IST `YYYY-MM-DD`, for `<input type="date" max>`. */
export const maxStartDate = (now = new Date()): string =>
  istParts(new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS)).date;

/** Adds minutes to an ISO timestamp. */
export const addMinutes = (iso: string, minutes: number): Date =>
  new Date(new Date(iso).getTime() + minutes * 60 * 1000);

const showtimeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** `Sat, 12 Oct, 7:30 pm` */
export const formatShowtime = (value: string | Date): string => showtimeFormat.format(new Date(value));

/** `7:30 pm` */
export const formatTime = (value: string | Date): string => timeFormat.format(new Date(value));

/** `Sat, 12 Oct` — used for date group headers. */
export const formatDay = (value: string | Date): string => dayFormat.format(new Date(value));

/** `12 Oct 2026` — created/updated dates in tables. */
export const formatDate = (value: string | Date): string => dateFormat.format(new Date(value));

/** The IST calendar date of a timestamp, for grouping screenings by day. */
export const istDateKey = (value: string | Date): string => istParts(new Date(value)).date;

/** `135` → `2h 15m`; `45` → `45m`; `120` → `2h`. */
export const formatDuration = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** `"250.00"` or `250` → `₹250`; `249.5` → `₹249.50`. Render inside `.tabular-nums`. */
export const formatINR = (value: string | number): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return (Number.isInteger(n) ? inrWhole : inrPaise).format(n);
};
