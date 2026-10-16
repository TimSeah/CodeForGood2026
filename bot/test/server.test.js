import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp, validSignature } from '../src/server.js';
import { Store } from '../src/store.js';

test('webhook signature requires the exact original body', () => {
  const body = Buffer.from('{"entry":[]}');
  const header = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
  assert.equal(validSignature(body, header, 'secret'), true);
  assert.equal(validSignature(Buffer.from('{"entry": []}'), header, 'secret'), false);
  assert.equal(validSignature(body, 'sha256=bad', 'secret'), false);
});

test('signed webhook persists once and rejects unsigned events', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'absence-bot-'));
  const store = new Store(join(folder, 'test.sqlite'));
  const sent = [];
  const app = createApp({
    store,
    whatsapp: { send: async (message) => sent.push(message), media: async () => { throw Error('unexpected'); } },
    appSecret: 'secret',
    verifyToken: 'verify',
    now: () => new Date('2026-10-15T16:10:00Z'),
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}/webhook`;
  assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=abc`)).status, 200);
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.1', from: '6599999999', type: 'text', text: { body: 'start' } }] } }] }] });
  assert.equal((await fetch(base, { method: 'POST', body })).status, 403);
  const headers = { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}` };
  assert.equal((await fetch(base, { method: 'POST', body, headers })).status, 200);
  await app.drain();
  assert.equal((await fetch(base, { method: 'POST', body, headers })).status, 200);
  await app.drain();
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM inbound').get().n, 1);
  assert.equal(sent.length, 1);
  assert.equal(store.db.prepare("SELECT payload FROM inbound WHERE id = 'wamid.1'").get().payload, '{}');
  assert.equal(store.db.prepare('SELECT payload FROM outbound WHERE sent_at IS NOT NULL').get().payload, '{}');
});

test('confirmed report persists inclusive date ranges for admin review', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'absence-bot-'));
  const store = new Store(join(folder, 'test.sqlite'));
  const app = createApp({
    store,
    whatsapp: { send: async () => {}, media: async () => { throw Error('unexpected'); } },
    appSecret: 'secret', verifyToken: 'verify',
    now: () => new Date('2026-10-15T16:10:00Z'),
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}/webhook`;
  const send = async (id, input) => {
    const message = typeof input === 'string' ?
      { type: 'text', text: { body: input } } :
      { type: 'interactive', interactive: { button_reply: { id: input.button } } };
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from: '6599999999', ...message }] } }] }] });
    const headers = { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}` };
    assert.equal((await fetch(base, { method: 'POST', body, headers })).status, 200);
    await app.drain();
  };
  await send('1', 'start');
  await send('2', { button: 'role:therapist' });
  await send('3', 'Jo Tan');
  await send('4', '17/10/2026 to 19/10/2026, 22/10/2026');
  await send('5', { button: 'scope:am' });
  await send('6', { button: 'confirm:yes' });
  const rows = store.db.prepare('SELECT role, name, start_date, end_date, day_part, status FROM absences ORDER BY id').all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [
    { role: 'therapist', name: 'Jo Tan', start_date: '2026-10-17', end_date: '2026-10-19', day_part: 'morning', status: 'pending_admin_review' },
    { role: 'therapist', name: 'Jo Tan', start_date: '2026-10-22', end_date: '2026-10-22', day_part: 'morning', status: 'pending_admin_review' },
  ]);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM audit').get().n, 1);
  const exported = spawnSync(process.execPath, [fileURLToPath(new URL('../src/export.js', import.meta.url))], {
    env: { ...process.env, DB_PATH: join(folder, 'test.sqlite') },
    encoding: 'utf8',
  });
  assert.equal(exported.status, 0, exported.stderr);
  const output = JSON.parse(exported.stdout);
  assert.equal(output.absences.length, 2);
  assert.deepEqual(output.failedReplies, []);
});

test('a new webhook arriving during an outbound send is processed immediately', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'absence-bot-'));
  const store = new Store(join(folder, 'test.sqlite'));
  let release;
  let started;
  const sendStarted = new Promise((resolve) => { started = resolve; });
  const firstSend = new Promise((resolve) => { release = resolve; });
  const sent = [];
  const app = createApp({
    store,
    whatsapp: {
      send: async (message) => {
        sent.push(message);
        if (sent.length === 1) { started(); await firstSend; }
      },
      media: async () => { throw Error('unexpected'); },
    },
    appSecret: 'secret', verifyToken: 'verify',
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    release();
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${app.server.address().port}/webhook`;
  const post = async (id) => {
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from: '6599999999', type: 'text', text: { body: 'start' } }] } }] }] });
    const headers = { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}` };
    assert.equal((await fetch(url, { method: 'POST', body, headers })).status, 200);
  };
  await post('first');
  await sendStarted;
  await post('second');
  release();
  await app.drain();
  assert.equal(sent.length, 2);
});

test('a failed reply is deferred without blocking replies to other reporters', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'absence-bot-'));
  const store = new Store(join(folder, 'test.sqlite'));
  const sent = [];
  const app = createApp({
    store,
    whatsapp: {
      send: async (message) => {
        if (message.to === '6599999991') throw new Error('blocked recipient');
        sent.push(message.to);
      },
      media: async () => { throw Error('unexpected'); },
    },
    appSecret: 'secret', verifyToken: 'verify',
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  store.enqueue('one', { id: 'one', from: '6599999991', type: 'text', text: { body: 'start' } });
  store.enqueue('two', { id: 'two', from: '6599999992', type: 'text', text: { body: 'start' } });
  const originalError = console.error;
  console.error = () => {};
  try {
    await app.drain();
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(sent, ['6599999992']);
  const failed = store.db.prepare('SELECT id, attempts FROM outbound WHERE attempts > 0').get();
  assert.equal(failed.attempts, 1);
  for (let attempt = 1; attempt < 5; attempt++) store.sendFailed(failed.id);
  const permanent = store.db.prepare('SELECT attempts, failed_at, payload, to_phone, inbound_id FROM outbound WHERE id = ?').get(failed.id);
  assert.equal(permanent.attempts, 5);
  assert.ok(permanent.failed_at);
  assert.equal(permanent.payload, '{}');
  assert.equal(permanent.to_phone, '6599999991');
  assert.equal(permanent.inbound_id, 'one');
});
