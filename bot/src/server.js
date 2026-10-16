import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBot } from './bot.js';
import { createMcWorker } from './mc.js';
import { Store } from './store.js';
import { createWhatsAppClient, incoming } from './whatsapp.js';

export function validSignature(body, header, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(header ?? '')) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(header.slice(7), 'hex');
  return timingSafeEqual(expected, actual);
}

export function createApp({ store, whatsapp, appSecret, verifyToken, workerFactory = createMcWorker, now }) {
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
            await whatsapp.send(JSON.parse(output.payload));
            store.sent(output.id);
          } catch (error) {
            console.error('WhatsApp send failed for outbound ID:', output.id, error);
            if (store.sendFailed(output.id)) {
              console.error('WhatsApp reply permanently failed after five attempts:', output.id);
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
      res.writeHead(200).end('OK');
      void drain().catch((error) => console.error('Queue processing failed:', error));
    } catch (error) {
      console.error('Webhook processing failed:', error);
      res.writeHead(error instanceof SyntaxError ? 400 : 500).end();
    }
  });
  const retry = setInterval(() => void drain().catch((error) => console.error('Queue retry failed:', error)), 30_000);
  retry.unref();
  return {
    server,
    drain,
    close() {
      clearInterval(retry);
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET, META_VERIFY_TOKEN, GRAPH_API_VERSION, DB_PATH, PORT } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !META_APP_SECRET || !META_VERIFY_TOKEN) {
    throw new Error('Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET and META_VERIFY_TOKEN.');
  }
  const store = new Store(DB_PATH ?? 'absences.sqlite');
  const app = createApp({
    store,
    whatsapp: createWhatsAppClient({ token: WHATSAPP_TOKEN, phoneNumberId: WHATSAPP_PHONE_NUMBER_ID, version: GRAPH_API_VERSION }),
    appSecret: META_APP_SECRET,
    verifyToken: META_VERIFY_TOKEN,
  });
  app.server.listen(Number(PORT ?? 3000), () => {
    console.log(`WhatsApp webhook listening on port ${PORT ?? 3000}`);
    void app.drain().catch((error) => console.error('Startup queue failed:', error));
  });
}
