import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBot } from './bot.js';
import { BackendError, createBackendClient } from './backend.js';
import { createMcWorker } from './mc.js';
import { Store } from './store.js';
import { recipientPhone, templateMessage } from './templates.js';
import { createWhatsAppClient, incoming } from './whatsapp.js';

export function validSignature(body, header, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(header ?? '')) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(header.slice(7), 'hex');
  return timingSafeEqual(expected, actual);
}

export function createApp({ store, whatsapp, backend, sessionOnly = false, appSecret, verifyToken, workerFactory = createMcWorker, now }) {
  if (!appSecret || !verifyToken) throw new Error('META_APP_SECRET and META_VERIFY_TOKEN are required.');
  const bot = createBot({ media: (id) => whatsapp.media(id), workerFactory, now });
  let activeDrain;
  let rerun = false;
  function drain() {
    if (activeDrain) {
      rerun = true;
      return activeDrain;
    }
    activeDrain = (async () => {
      do {
        rerun = false;
        let job;
        while ((job = store.next())) {
          try {
            const match = backend && job.message.type === 'text' &&
              /^\s*(yes|no)(?:\s+(\d+))?\s*$/i.exec(job.message.text?.body ?? '');
            if (match) {
              const assignmentId = match[2] ? Number(match[2]) :
                job.message.context?.id ? store.assignmentForMessage(job.message.context.id) : null;
              try {
                const answer = await backend.reply({
                  messageId: job.id, phone: job.message.from,
                  ...(assignmentId ? { assignmentId } : {}),
                  response: match[1].toLowerCase(),
                });
                store.apply(job.id, job.message.from, {
                  draft: store.draft(job.message.from),
                  replies: [{ type: 'text', text: { body: `Thank you. Your response for session reference ${answer.assignmentId} was recorded.` } }],
                });
              } catch (error) {
                if (error instanceof BackendError && [404, 409].includes(error.status)) {
                  store.apply(job.id, job.message.from, {
                    draft: store.draft(job.message.from),
                    replies: [{ type: 'text', text: { body: error.message } }],
                  });
                } else {
                  console.error('Parent response could not reach the backend; retrying:', job.id, error);
                  store.defer(job.id);
                }
              }
              continue;
            }
            const result = await bot(job.message, store.draft(job.message.from));
            store.apply(job.id, job.message.from, result);
          } catch (error) {
            console.error('Inbound processing failed:', job.id, error);
            store.fail(job.id, job.message.from);
          }
        }
        let output;
        while ((output = store.unsent())) {
          try {
            let message = JSON.parse(output.payload);
            if (output.notification_id) {
              const notification = message.notification;
              if (sessionOnly) {
                const to = recipientPhone(notification.toPhone);
                if (!store.hasOpenConversation(to)) throw new Error('No open WhatsApp conversation; ask this recipient to send START before sending a POC notice');
                if (!notification.body?.trim()) throw new Error('Backend notification has no message body');
                message = { to, type: 'text', text: { body: notification.body } };
              } else {
                const mediaId = notification.attachment ?
                  await whatsapp.uploadDocument(await backend.attachment(notification.id)) : null;
                message = templateMessage(notification, mediaId);
              }
            }
            const messageId = await whatsapp.send(message);
            if (output.notification_id && !messageId) throw new Error('WhatsApp did not return a message ID');
            store.sent(output.id, messageId);
          } catch (error) {
            console.error('WhatsApp send failed for outbound ID:', output.id, error);
            if (store.sendFailed(output.id, error.message)) {
              console.error('WhatsApp outbound message permanently failed after five attempts:', output.id);
            }
          }
        }
        if (backend) {
          let event;
          while ((event = store.nextEvent())) {
            try {
              await backend.status(event.notification_id, {
                status: event.status, messageId: event.message_id, error: event.error,
              });
              store.eventDone(event.id);
            } catch (error) {
              console.error('Delivery status could not reach the backend; retrying:', event.id, error);
              break;
            }
          }
        }
      } while (rerun);
    })().finally(() => {
      activeDrain = undefined;
      if (rerun) void drain().catch((error) => console.error('Queue recheck failed:', error));
    });
    return activeDrain;
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/webhook') {
      res.writeHead(404).end();
      return;
    }
    if (req.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === verifyToken) {
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end(url.searchParams.get('hub.challenge') ?? '');
      } else {
        res.writeHead(403).end();
      }
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 1_000_000) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    if (!validSignature(body, req.headers['x-hub-signature-256'], appSecret)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const payload = JSON.parse(body.toString('utf8'));
      for (const message of incoming(payload)) store.enqueue(message.id, message);
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          for (const status of change.value?.statuses ?? []) {
            if (status.id && ['sent', 'delivered', 'read', 'failed'].includes(status.status)) {
              store.recordDelivery(status.id, status.status, status.errors?.[0]?.title ?? null);
            }
          }
        }
      }
      res.writeHead(200).end('OK');
      void drain().catch((error) => console.error('Queue processing failed:', error));
    } catch (error) {
      console.error('Webhook processing failed:', error);
      res.writeHead(error instanceof SyntaxError ? 400 : 500).end();
    }
  });
  async function poll() {
    if (!backend) return;
    try {
      await backend.sync();
    } catch (error) {
      console.error('Backend report sync failed; retrying:', error);
    }
    try {
      for (const notification of await backend.pending()) {
        store.queueNotification(notification, { notification });
      }
      await drain();
    } catch (error) {
      console.error('Backend outbox poll failed; retrying:', error);
    }
  }
  const retry = setInterval(() => {
    void (backend ? poll() : drain().catch((error) => console.error('Queue retry failed:', error)));
  }, 30_000);
  retry.unref();
  return {
    server,
    drain,
    poll,
    close() {
      clearInterval(retry);
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET, META_VERIFY_TOKEN, GRAPH_API_VERSION, DB_PATH, PORT,
    BACKEND_URL, BOT_SHARED_SECRET, POC_SESSION_MESSAGES } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !META_APP_SECRET || !META_VERIFY_TOKEN) {
    throw new Error('Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET and META_VERIFY_TOKEN.');
  }
  if (Boolean(BACKEND_URL) !== Boolean(BOT_SHARED_SECRET)) {
    throw new Error('Set both BACKEND_URL and BOT_SHARED_SECRET to connect the backend.');
  }
  const store = new Store(DB_PATH ?? 'absences.sqlite');
  const app = createApp({
    store,
    whatsapp: createWhatsAppClient({ token: WHATSAPP_TOKEN, phoneNumberId: WHATSAPP_PHONE_NUMBER_ID, version: GRAPH_API_VERSION }),
    backend: BACKEND_URL ? createBackendClient({ url: BACKEND_URL, secret: BOT_SHARED_SECRET }) : null,
    sessionOnly: POC_SESSION_MESSAGES === 'true',
    appSecret: META_APP_SECRET,
    verifyToken: META_VERIFY_TOKEN,
  });
  app.server.listen(Number(PORT ?? 3000), () => {
    console.log(`WhatsApp webhook listening on port ${PORT ?? 3000}`);
    void app.poll().then(() => app.drain()).catch((error) => console.error('Startup queue failed:', error));
  });
}
