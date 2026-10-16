import assert from 'node:assert/strict';
import test from 'node:test';
import { createBot } from '../src/bot.js';

const now = () => new Date('2026-10-15T16:10:00Z');
const bot = createBot({
  now,
  media: async () => ({ data: Buffer.from('mock mc'), mime: 'image/png' }),
  recognize: async () => 'Patient Name: Alex Tan\nUnfit for school from 16/10/2026 to 18/10/2026',
});
const button = (id) => ({ type: 'interactive', interactive: { button_reply: { id } } });
const row = (id) => ({ type: 'interactive', interactive: { list_reply: { id } } });
const words = (body) => ({ type: 'text', text: { body } });

async function advance(handler, draft, message) {
  return handler(message, draft).then((result) => result);
}

test('MC prefills name/dates but cannot submit before confirmation', async () => {
  let result = await advance(bot, { stage: 'role' }, { type: 'image', image: { id: 'media-1' } });
  assert.equal(result.draft.name, 'Alex Tan');
  assert.deepEqual(result.draft.intervals, [{ start: '2026-10-16', end: '2026-10-18' }]);
  assert.equal(result.draft.stage, 'role');
  result = await advance(bot, result.draft, button('role:patient'));
  assert.equal(result.draft.stage, 'scope');
  result = await advance(bot, result.draft, button('scope:all'));
  assert.equal(result.draft.stage, 'confirm');
  assert.match(result.replies[0].interactive.body.text, /MC: attached/);
  result = await advance(bot, result.draft, button('confirm:yes'));
  assert.equal(result.submission.name, 'Alex Tan');
  assert.equal(result.draft.stage, 'role');
  assert.equal(result.intervals.length, 1);
});

test('selecting a date range by list then editing dates', async () => {
  let result = await advance(bot, { stage: 'role' }, button('role:therapist'));
  result = await advance(bot, result.draft, words('Jo Tan'));
  result = await advance(bot, result.draft, button('date:other'));
  assert.equal(result.replies[0].interactive.action.sections[0].rows.length, 10);
  result = await advance(bot, result.draft, row('pick:2026-10-17'));
  result = await advance(bot, result.draft, button('duration:range'));
  result = await advance(bot, result.draft, row('pick:2026-10-19'));
  result = await advance(bot, result.draft, button('scope:am'));
  assert.deepEqual(result.draft.intervals, [{ start: '2026-10-17', end: '2026-10-19' }]);
  result = await advance(bot, result.draft, button('confirm:edit'));
  result = await advance(bot, result.draft, button('edit:dates'));
  result = await advance(bot, result.draft, words('24/10/2026, 27/10/2026 to 28/10/2026'));
  assert.equal(result.draft.stage, 'scope');
  assert.equal(result.draft.intervals.length, 2);
});

test('unreadable MC keeps manual entry available and does not invent dates', async () => {
  const unreadable = createBot({ now, media: async () => ({ data: Buffer.from('x'), mime: 'image/png' }), recognize: async () => 'Issued 16/10/2026' });
  const result = await unreadable({ type: 'image', image: { id: 'media-2' } }, { stage: 'dates', role: 'therapist', name: 'Jo Tan' });
  assert.equal(result.draft.stage, 'dates');
  assert.equal(result.draft.intervals, undefined);
  assert.match(result.replies[0].text.body, /could not reliably identify/);
});

test('wrong interactive step and impossible typed date cannot be submitted', async () => {
  const draft = { stage: 'dates', role: 'therapist', name: 'Jo Tan' };
  const result = await advance(bot, draft, words('31/02/2027'));
  assert.equal(result.draft.stage, 'dates');
  assert.equal(result.intervals, undefined);
});
