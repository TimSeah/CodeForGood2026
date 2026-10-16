import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { BackendError, createBackendClient } from '../src/backend.js';
import { createApp } from '../src/server.js';
import { Store } from '../src/store.js';
import { templateMessage } from '../src/templates.js';

const notification = {
  id: 12, toPhone: '+6591234567', purpose: 'parent_confirm',
  body: 'Autism Partnership: please reply YES 32 or NO 32.',
  planAssignmentId: 32,
  variables: ['Alex', 'Sam', '2031-07-11, 8:30am-12:00pm', 'Jo Tan', '2031-07-11 8:15 SGT', '32'],
  attachment: null,
};

test('templates use approved names, exactly scoped variables and a document header only with a PDF', () => {
  const sent = templateMessage(notification);
  assert.equal(sent.to, '6591234567');
  assert.equal(sent.template.name, 'ap_parent_confirm');
  assert.deepEqual(sent.template.components[0].parameters.map((p) => p.text), notification.variables);
  const document = templateMessage({
    id: 13, toPhone: '6591234567', purpose: 'therapist_cover',
    variables: ['Jo', 'Sam', 'clinic', '2031-07-11, 8:30am-12:00pm'], attachment: '/api/session-logs/1/pdf',
  }, 'media1');
  assert.equal(document.template.name, 'ap_therapist_cover_document');
  assert.deepEqual(document.template.components[0].parameters[0].document, { id: 'media1', filename: 'session-handover.pdf' });
  assert.throws(() => templateMessage({ ...notification, variables: [] }), /variables/);
  assert.throws(() => templateMessage({ ...notification, toPhone: 'not-a-number' }), /phone/);
});

test('backend client stays local and authenticates every request', async () => {
  assert.throws(() => createBackendClient({ url: 'https://example.com/', secret: 'x' }), /local HTTP/);
  const calls = [];
  const backend = createBackendClient({
    url: 'http://127.0.0.1:3001/', secret: 'test-secret',
    fetcher: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
    },
  });

  await backend.pending();
  await backend.sync();
  assert.equal(calls[0].url, 'http://127.0.0.1:3001/api/whatsapp/outbox');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-secret');
  assert.equal(calls[1].url, 'http://127.0.0.1:3001/api/intake/sync');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-secret');
});

test('existing bot databases migrate without losing queued inbound messages', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'bot-existing-'));
  const file = join(folder, 'bot.sqlite');
  const previous = new DatabaseSync(file);
  previous.exec(`CREATE TABLE inbound (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO inbound (id, payload) VALUES ('before-upgrade', '{"id":"before-upgrade","from":"6591234567"}');`);
  previous.close();
  const store = new Store(file);
  t.after(() => { store.close(); rmSync(folder, { recursive: true, force: true }); });
  assert.equal(store.next().id, 'before-upgrade');
  store.enqueue('after-upgrade', { id: 'after-upgrade', from: '6591234567' });
  assert.equal(store.next().id, 'after-upgrade');
});

test('poll sends one template, forwards Meta status and routes parent answer once', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'bot-bridge-'));
  const store = new Store(join(folder, 'bot.sqlite'));
  const sends = [];
  const updates = [];
  const replies = [];
  let syncs = 0;
  const backend = {
    sync: async () => { syncs++; },
    pending: async () => [notification],
    status: async (id, event) => { updates.push({ id, ...event }); },
    reply: async (body) => { replies.push(body); return { assignmentId: body.assignmentId, response: body.response }; },
    attachment: async () => { throw Error('unexpected attachment'); },
  };
  const app = createApp({
    store, backend, appSecret: 'secret', verifyToken: 'verify',
    whatsapp: {
      send: async (message) => { sends.push(message); return `wamid.${sends.length}`; },
      media: async () => { throw Error('unexpected media'); },
    },
  });

  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const post = async (value) => {
    const body = JSON.stringify({ entry: [{ changes: [{ value }] }] });
    const signature = createHmac('sha256', 'secret').update(body).digest('hex');
    const res = await fetch(`http://127.0.0.1:${app.server.address().port}/webhook`, {
      method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${signature}` },
    });
    assert.equal(res.status, 200);
    await app.drain();
  };

  await app.poll();
  await app.poll();
  assert.equal(syncs, 2);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].template.name, 'ap_parent_confirm');
  assert.deepEqual(updates, [{ id: 12, status: 'sent', messageId: 'wamid.1', error: null }]);

  await post({ statuses: [{ id: 'wamid.1', status: 'delivered' }] });
  assert.equal(updates.at(-1).status, 'delivered');
  await post({ messages: [{ id: 'incoming.1', from: '6591234567', type: 'text', text: { body: 'YES' }, context: { id: 'wamid.1' } }] });
  assert.deepEqual(replies, [{ messageId: 'incoming.1', phone: '6591234567', assignmentId: 32, response: 'yes' }]);
  assert.equal(sends.at(-1).text.body, 'Thank you. Your response for session reference 32 was recorded.');
  await post({ messages: [{ id: 'incoming.1', from: '6591234567', type: 'text', text: { body: 'YES' }, context: { id: 'wamid.1' } }] });
  assert.equal(replies.length, 1);
});

test('an offline backend defers parent replies without losing the signed inbound event', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'bot-reply-'));
  const store = new Store(join(folder, 'bot.sqlite'));
  let available = false;
  const sent = [];
  const app = createApp({
    store, appSecret: 'secret', verifyToken: 'verify',
    backend: {
      sync: async () => {},
      reply: async () => {
        if (!available) throw new BackendError(503, 'backend unavailable');
        return { assignmentId: 32 };
      },
      status: async () => {}, pending: async () => [], attachment: async () => Buffer.from(''),
    },
    whatsapp: { send: async (message) => { sent.push(message); }, media: async () => {} },
  });

  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close(); store.close(); rmSync(folder, { recursive: true, force: true });
  });
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [
    { id: 'reply.1', from: '6591234567', type: 'text', text: { body: 'NO 32' } },
  ] } }] }] });
  const signature = createHmac('sha256', 'secret').update(body).digest('hex');
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await fetch(`http://127.0.0.1:${app.server.address().port}/webhook`, {
      method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${signature}` },
    });
    assert.equal(result.status, 200);
    await app.drain();
  } finally { console.error = originalError; }
  assert.equal(store.db.prepare("SELECT status FROM inbound WHERE id = 'reply.1'").get().status, 'pending');
  assert.equal(sent.length, 0);
  available = true;
  store.db.prepare("UPDATE inbound SET next_retry_at = datetime('now', '-1 second') WHERE id = 'reply.1'").run();
  await app.drain();
  assert.equal(store.db.prepare("SELECT status FROM inbound WHERE id = 'reply.1'").get().status, 'done');
  assert.equal(sent.length, 1);
});

test('POC notices use standard text only inside an open recipient conversation', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'bot-poc-'));
  const store = new Store(join(folder, 'bot.sqlite'));
  const sent = [];
  const updates = [];
  let notices = [{ ...notification, id: 90 }];
  const app = createApp({
    store, appSecret: 'secret', verifyToken: 'verify', sessionOnly: true,
    backend: {
      sync: async () => {}, pending: async () => notices,
      status: async (id, event) => updates.push({ id, ...event }),
      reply: async () => {}, attachment: async () => { throw Error('POC must not fetch a document'); },
    },
    whatsapp: {
      send: async (message) => { sent.push(message); return `wamid.${sent.length}`; },
      media: async () => {},
    },
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await app.close(); store.close(); rmSync(folder, { recursive: true, force: true }); });
  store.enqueue('signed-inbound', { id: 'signed-inbound', from: '6591234567', type: 'text', text: { body: 'START' } });
  await app.poll();
  assert.ok(sent.some((message) => message.type === 'text' && message.text.body === notification.body));
  assert.equal(updates.at(-1).status, 'sent');

  store.db.prepare("UPDATE last_contact SET last_inbound_at = datetime('now', '-25 hours')").run();
  notices = [{ ...notification, id: 91 }];
  const before = sent.length;
  const originalError = console.error;
  console.error = () => {};
  try { await app.poll(); } finally { console.error = originalError; }
  assert.equal(sent.length, before);
  assert.equal(store.db.prepare('SELECT attempts FROM outbound WHERE notification_id = 91').get().attempts, 1);
});
