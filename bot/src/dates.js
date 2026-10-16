const DAY_MS = 86_400_000;

export function isoToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseDate(value) {
  const match = /^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[/.](\d{1,2})[/.](\d{4}))$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1] ?? match[6]);
  const month = Number(match[2] ?? match[5]);
  const day = Number(match[3] ?? match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function parseIntervals(input, today = isoToday()) {
  const entries = input.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  if (!entries.length || entries.length > 12) throw new Error('Enter 1 to 12 dates or ranges.');
  const intervals = entries.map((entry) => {
    const match = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})(?:\s+(?:to|through|-)\s+(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}))?$/i.exec(entry);
    if (!match) throw new Error('Use DD/MM/YYYY or DD/MM/YYYY to DD/MM/YYYY; separate ranges with commas.');
    const start = parseDate(match[1]);
    const end = parseDate(match[2] ?? match[1]);
    if (!start || !end) throw new Error('Check the date: it must be a real calendar date.');
    if (start < today || end < start) throw new Error('Dates must start today or later and end on or after the start.');
    if ((Date.parse(end) - Date.parse(start)) / DAY_MS > 366) throw new Error('Please report at most one year per range.');
    return { start, end };
  });
  intervals.sort((a, b) => a.start.localeCompare(b.start));
  const merged = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval.start <= addDays(previous.end, 1)) {
      if (interval.end > previous.end) previous.end = interval.end;
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function formatIntervals(intervals) {
  return intervals.map(({ start, end }) => start === end ? start : `${start} to ${end}`).join(', ');
}
