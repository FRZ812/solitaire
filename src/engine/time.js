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
