// Calendar + clock.
//
// The world uses a 12-month, 30-day-per-month, 360-day-per-year calendar.
// Campaign day 1 corresponds to the 1st of Hollowsmonth, year 803; the
// Wanderer's opening at the Drowned Inn (day 3) is the 3rd of Hollowsmonth.
// Month names are evocative-English (Le Guin / McCarthy register) rather
// than invented fantasy syllables.
//
// The persistent state shape is unchanged — time is still
// { day, hour, minute } — so old saves keep working. Year and month are
// DERIVED from the day count at render time via getCalendarDate().

export const MONTHS = [
  "Stillmonth",     //  1 — deep winter, the world held still
  "Frostfast",      //  2 — late winter, frost holds the ground
  "Greentide",      //  3 — early spring, hedges leafing
  "Bloomtide",      //  4 — late spring, blossom on every road
  "Mirewarm",       //  5 — early summer, the marsh begins to warm
  "Highsun",        //  6 — midsummer, days at their longest
  "Hayfast",        //  7 — haymaking
  "Reapermonth",    //  8 — main harvest
  "Smokemonth",     //  9 — stubble-burning, late harvest
  "Hollowsmonth",   // 10 — late autumn, leaves down, rain begins
  "Rainmonth",      // 11 — full wet season
  "Lastlight",      // 12 — winter solstice, the year's end
];

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = MONTHS.length;
export const DAYS_PER_YEAR = MONTHS_PER_YEAR * DAYS_PER_MONTH; // 360

// Campaign day 1 maps to this calendar date.
export const BASE_MONTH_INDEX = 9; // Hollowsmonth (zero-indexed)
export const BASE_DAY_OF_MONTH = 1;
export const BASE_YEAR = 803;

const BASE_DAY_INDEX = BASE_MONTH_INDEX * DAYS_PER_MONTH + (BASE_DAY_OF_MONTH - 1);

// Returns { year, monthIndex, monthName, dayOfMonth } for the given time.
export function getCalendarDate(time) {
  const campaignDay = Math.max(1, (time?.day | 0) || 1);
  const absoluteDayIndex = BASE_DAY_INDEX + (campaignDay - 1);
  const yearOffset = Math.floor(absoluteDayIndex / DAYS_PER_YEAR);
  const dayOfYear = ((absoluteDayIndex % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const monthIndex = Math.floor(dayOfYear / DAYS_PER_MONTH);
  const dayOfMonth = (dayOfYear % DAYS_PER_MONTH) + 1;
  return {
    year: BASE_YEAR + yearOffset,
    monthIndex,
    monthName: MONTHS[monthIndex],
    dayOfMonth,
  };
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// "3rd of Hollowsmonth, 803" — narrator-facing, full form.
export function formatDate(time) {
  const d = getCalendarDate(time);
  return `${ordinal(d.dayOfMonth)} of ${d.monthName}, ${d.year}`;
}

// "3 Hollowsmonth" — UI-facing, compact (no year, no ordinal suffix).
// The year is surfaced separately so it doesn't crowd the header chip.
export function formatDateCompact(time) {
  const d = getCalendarDate(time);
  return `${d.dayOfMonth} ${d.monthName}`;
}

export function formatTime({ hour, minute }) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function advanceTime(time, minutes) {
  let { day, hour, minute } = time;
  minute += minutes;
  while (minute >= 60) { minute -= 60; hour += 1; }
  while (hour >= 24)   { hour -= 24; day += 1; }
  return { day, hour, minute };
}
