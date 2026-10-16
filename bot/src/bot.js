import { createHash } from 'node:crypto';
import { addDays, formatIntervals, isoToday, parseDate, parseIntervals } from './dates.js';
import { extractMcFields, recognizeMc } from './mc.js';
import { buttons, list, text } from './whatsapp.js';

const rolePrompt = () => buttons('Who cannot attend? For a child, a parent or caregiver may report on their behalf.', [
  ['role:therapist', 'Therapist'], ['role:patient', 'Patient / child'],
]);
const datePrompt = () => buttons('When are they unavailable? You can also send a JPG, PNG or PDF MC at any time.', [
  ['date:today', 'Today'], ['date:tomorrow', 'Tomorrow'], ['date:other', 'Other dates'],
]);
const scopePrompt = () => buttons('Are they unavailable for the whole day or only part of it?', [
  ['scope:all', 'Whole day'], ['scope:am', 'Morning'], ['scope:pm', 'Afternoon'],
]);
const namePrompt = () => text('What is the therapist or child’s full name? (For a child, enter the child’s name, not the caregiver’s.)');

function dateList(today, start) {
  const base = start ?? today;
  const options = Array.from({ length: 9 }, (_, i) => {
    const date = addDays(base, i);
    return [`pick:${date}`, date];
  });
  options.push(['pick:type', 'Type a date / range']);
  return list(start ? `Choose the last unavailable date (from ${start}), or type it.` :
    'Choose the first unavailable date, or type dates/ranges separated by commas.', options);
}

function confirmPrompt(draft) {
  return buttons(`${draft.role === 'patient' ? 'Patient' : 'Therapist'}: ${draft.name}\nUnavailable: ${formatIntervals(draft.intervals)} (${draft.dayPart})\nMC: ${draft.mc ? 'attached; admin review required' : 'not attached'}\nIs this correct?`, [
    ['confirm:yes', 'Confirm'], ['confirm:edit', 'Edit'], ['confirm:cancel', 'Cancel'],
  ]);
}

function nextPrompt(draft) {
  if (!draft.role) return { ...draft, stage: 'role', replies: [rolePrompt()] };
  if (!draft.name) return { ...draft, stage: 'name', replies: [namePrompt()] };
  if (!draft.intervals?.length) return { ...draft, stage: 'dates', replies: [datePrompt()] };
  if (!draft.dayPart) return { ...draft, stage: 'scope', replies: [scopePrompt()] };
  return { ...draft, stage: 'confirm', replies: [confirmPrompt(draft)] };
}

function invalid(draft, message) {
  return { draft, replies: [text(message)] };
}

export function createBot({ media, recognize = recognizeMc, workerFactory, now = () => new Date() }) {
  return async function handle(message, current) {
    const today = isoToday(now());
    let draft = { ...current };
    const value = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ??
      (message.type === 'text' ? message.text?.body?.trim() : null);
    if (value && /^(cancel|stop)$/i.test(value)) {
      return { draft: null, replies: [text('Cancelled. Send START to report another absence.')] };
    }
    if (value && /^(start|hi|hello|help)$/i.test(value)) {
      draft = { stage: 'role' };
      return { draft, replies: [rolePrompt()] };
    }

    if (message.type === 'image' || message.type === 'document') {
      const attachment = message[message.type];
      if (!attachment?.id) return invalid(draft, 'The attachment has no media ID. Please resend the MC.');
      try {
        const { data, mime } = await media(attachment.id);
        const recognized = await recognize(data, mime, workerFactory);
        const extracted = extractMcFields(recognized, today);
        draft.mc = { id: attachment.id, mime, sha256: createHash('sha256').update(data).digest('hex') };
        if (extracted.name && !draft.name) draft.name = extracted.name;
        if (extracted.intervals.length) {
          draft.intervals = extracted.intervals;
          draft.dayPart = null;
        }
        const next = nextPrompt(draft);
        return {
          draft: { ...next, replies: undefined },
          replies: [text(extracted.intervals.length ?
            `MC received. I found ${formatIntervals(extracted.intervals)}. Please check the dates and name before confirming.` :
            'MC received, but I could not reliably identify unavailable dates. Please enter them manually.'), ...next.replies],
        };
      } catch (error) {
        return invalid(draft, `I could not process that MC (${error.message}). Please resend a JPG, PNG, WebP or PDF under 10 MB, or enter the dates manually. This attachment was not added.`);
      }
    }

    if (!value) return invalid(draft, 'Please send text or an MC image/PDF. Send START to begin.');
    if (draft.stage === 'role') {
      if (!['role:therapist', 'role:patient'].includes(value)) return invalid(draft, 'Please use the Therapist or Patient button.');
      draft.role = value.slice(5);
      const next = nextPrompt(draft);
      return { draft: { ...next, replies: undefined }, replies: next.replies };
    }
    if (draft.stage === 'name') {
      if (message.type !== 'text' || !/^[\p{L}][\p{L} .'-]{1,79}$/u.test(value)) {
        return invalid(draft, 'Please type a full name (2–80 letters, spaces, apostrophes or hyphens).');
      }
      draft.name = value.replace(/\s+/g, ' ');
      const next = nextPrompt(draft);
      return { draft: { ...next, replies: undefined }, replies: next.replies };
    }
    if (draft.stage === 'dates') {
      if (value === 'date:today' || value === 'date:tomorrow') {
        const day = addDays(today, value === 'date:today' ? 0 : 1);
        draft.intervals = [{ start: day, end: day }];
      } else if (value === 'date:other') {
        draft.stage = 'pick-start';
        return { draft, replies: [dateList(today)] };
      } else if (message.type === 'text') {
        try {
          draft.intervals = parseIntervals(value, today);
        } catch (error) {
          return invalid(draft, error.message);
        }
      } else {
        return invalid(draft, 'Choose Today, Tomorrow, Other dates, or type DD/MM/YYYY to DD/MM/YYYY.');
      }
    } else if (draft.stage === 'pick-start') {
      if (value === 'pick:type') {
        draft.stage = 'dates';
        return { draft, replies: [text('Type DD/MM/YYYY or DD/MM/YYYY to DD/MM/YYYY. For separate dates, use commas.')] };
      }
      const chosen = value.startsWith('pick:') ? value.slice(5) : '';
      if (!parseDate(chosen) || chosen < today || chosen > addDays(today, 8)) {
        return invalid(draft, 'Please choose a listed date, or choose Type a date / range.');
      }
      draft.start = chosen;
      draft.stage = 'pick-duration';
      return { draft, replies: [buttons(`Starting ${chosen}. Is it one day or a date range?`, [
        ['duration:one', 'One day'], ['duration:range', 'Date range'], ['duration:type', 'Type date(s)'],
      ])] };
    } else if (draft.stage === 'pick-duration') {
      if (value === 'duration:one') {
        draft.intervals = [{ start: draft.start, end: draft.start }];
        delete draft.start;
      } else if (value === 'duration:range') {
        draft.stage = 'pick-end';
        return { draft, replies: [dateList(today, draft.start)] };
      } else if (value === 'duration:type') {
        delete draft.start;
        draft.stage = 'dates';
        return { draft, replies: [text('Type DD/MM/YYYY or DD/MM/YYYY to DD/MM/YYYY; separate multiple ranges with commas.')] };
      } else {
        return invalid(draft, 'Choose One day, Date range, or Type date(s).');
      }
    } else if (draft.stage === 'pick-end') {
      if (value === 'pick:type') {
        draft.stage = 'type-end';
        return { draft, replies: [text(`Type the last unavailable date after ${draft.start} as DD/MM/YYYY.`)] };
      }
      const chosen = value.startsWith('pick:') ? value.slice(5) : '';
      if (!parseDate(chosen) || chosen < draft.start || chosen > addDays(draft.start, 8)) {
        return invalid(draft, 'Please choose a listed end date or type one.');
      }
      draft.intervals = [{ start: draft.start, end: chosen }];
      delete draft.start;
    } else if (draft.stage === 'type-end') {
      const chosen = message.type === 'text' ? parseDate(value) : null;
      if (!chosen || chosen < draft.start || (Date.parse(chosen) - Date.parse(draft.start)) / 86_400_000 > 366) {
        return invalid(draft, 'Enter a valid last date (within one year) on or after the first date.');
      }
      draft.intervals = [{ start: draft.start, end: chosen }];
      delete draft.start;
    } else if (draft.stage === 'scope') {
      const parts = { 'scope:all': 'whole day', 'scope:am': 'morning', 'scope:pm': 'afternoon' };
      if (!parts[value]) return invalid(draft, 'Choose Whole day, Morning or Afternoon.');
      draft.dayPart = parts[value];
    } else if (draft.stage === 'confirm') {
      if (value === 'confirm:cancel') return { draft: null, replies: [text('Cancelled. Send START to report another absence.')] };
      if (value === 'confirm:edit') {
        draft.stage = 'edit';
        return { draft, replies: [buttons('What would you like to change?', [
          ['edit:name', 'Name'], ['edit:dates', 'Dates'], ['edit:scope', 'Time of day'],
        ])] };
      }
      if (value !== 'confirm:yes') return invalid(draft, 'Please Confirm, Edit or Cancel.');
      return {
        draft: { stage: 'role' },
        intervals: draft.intervals,
        submission: draft,
        replies: [text('Absence reported for admin review. This is not a confirmation of an approved schedule change. Send START to report another absence.')],
      };
    } else if (draft.stage === 'edit') {
      if (value === 'edit:name') { draft.name = null; draft.stage = 'name'; return { draft, replies: [namePrompt()] }; }
      if (value === 'edit:dates') { draft.intervals = null; draft.dayPart = null; draft.stage = 'dates'; return { draft, replies: [datePrompt()] }; }
      if (value === 'edit:scope') { draft.dayPart = null; draft.stage = 'scope'; return { draft, replies: [scopePrompt()] }; }
      return invalid(draft, 'Choose Name, Dates or Time of day; send CANCEL to start again.');
    } else {
      return { draft: { stage: 'role' }, replies: [rolePrompt()] };
    }
    const next = nextPrompt(draft);
    return { draft: { ...next, replies: undefined }, replies: next.replies };
  };
}
