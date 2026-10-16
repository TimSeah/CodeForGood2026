import assert from 'node:assert/strict';
import test from 'node:test';
import { createWhatsAppClient } from '../src/whatsapp.js';

test('downloads MC only from a verified Meta media host with bearer token', async () => {
  const calls = [];
  const client = createWhatsAppClient({
    token: 'test-token', phoneNumberId: '123',
    fetcher: async (url, options) => {
      calls.push({ url: String(url), options });
      return calls.length === 1 ?
        new Response(JSON.stringify({
          url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/test',
          mime_type: 'application/pdf', file_size: 3,
        }), { headers: { 'Content-Type': 'application/json' } }) :
        new Response(Buffer.from('PDF'), { headers: { 'Content-Length': '3' } });
    },
  });
  const result = await client.media('media-1');
  assert.equal(result.mime, 'application/pdf');
  assert.equal(result.data.toString(), 'PDF');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1].options.redirect, 'error');
});

test('refuses unexpected media hosts before sending credentials', async () => {
  let calls = 0;
  const client = createWhatsAppClient({
    token: 'test-token', phoneNumberId: '123',
    fetcher: async () => {
      calls++;
      return new Response(JSON.stringify({ url: 'https://example.org/attachment', mime_type: 'image/png' }));
    },
  });

  await assert.rejects(client.media('media-1'), /Unexpected media host/);
  assert.equal(calls, 1);
});

test('uploads a PDF as Meta media before the document template is sent', async () => {
  const calls = [];
  const client = createWhatsAppClient({
    token: 'test-token', phoneNumberId: '123',
    fetcher: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify(calls.length === 1 ? { id: 'media-123' } : { messages: [{ id: 'wamid.123' }] }));
    },
  });
  assert.equal(await client.uploadDocument(Buffer.from('%PDF-1.4')), 'media-123');
  assert.match(calls[0].url, /\/123\/media$/);
  assert.equal(calls[0].options.body.get('messaging_product'), 'whatsapp');
  assert.equal(calls[0].options.body.get('file').type, 'application/pdf');
  assert.equal(await client.send({ to: '6591234567', type: 'template', template: { name: 'ap_therapist_cover_document' } }), 'wamid.123');
});
