export function text(body) {
  return { type: 'text', text: { body } };
}

export function buttons(body, options) {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: options.map(([id, title]) => ({ type: 'reply', reply: { id, title } })),
      },
    },
  };
}

export function list(body, options) {
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: 'Choose date',
        sections: [{ title: 'Unavailable date', rows: options.map(([id, title]) => ({ id, title })) }],
      },
    },
  };
}

export function incoming(payload) {
  const messages = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (message.id && message.from) messages.push(message);
      }
    }
  }
  return messages;
}

export function createWhatsAppClient({ token, phoneNumberId, version = 'v25.0', fetcher = fetch }) {
  if (!token || !phoneNumberId || !/^v\d+\.\d+$/.test(version)) throw new Error('Set a WhatsApp token, phone number ID and valid Graph API version.');
  const base = `https://graph.facebook.com/${version}`;
  const headers = { Authorization: `Bearer ${token}` };

  async function json(url, options) {
    const response = await fetcher(url, options);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(`WhatsApp API returned HTTP ${response.status}, code ${result.error?.code ?? 'unknown'}: ${String(result.error?.message ?? 'request rejected').slice(0, 200)}`);
    }
    return result;
  }

  return {
    async send(message) {
      const result = await json(`${base}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...message }),
      });
      return result.messages?.[0]?.id;
    },
    async uploadDocument(data) {
      const form = new FormData();
      form.set('messaging_product', 'whatsapp');
      form.set('file', new Blob([data], { type: 'application/pdf' }), 'session-handover.pdf');
      const result = await json(`${base}/${phoneNumberId}/media`, { method: 'POST', headers, body: form });
      if (!result.id) throw new Error('WhatsApp media upload returned no ID');
      return result.id;
    },
    async media(id) {
      const info = await json(`${base}/${encodeURIComponent(id)}`, { headers });
      if (!info.url || !info.mime_type) throw new Error('Media details are incomplete.');
      const url = new URL(info.url);
      if (url.protocol !== 'https:' || !/(^|\.)facebook\.com$|(^|\.)fbcdn\.net$|(^|\.)fbsbx\.com$/.test(url.hostname)) {
        throw new Error('Unexpected media host.');
      }
      if (info.file_size > 10_000_000) throw new Error('MC exceeds the 10 MB limit.');
      const response = await fetcher(url, { headers, redirect: 'error' });
      if (!response.ok) throw new Error(`MC download returned HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > 10_000_000) throw new Error('MC exceeds the 10 MB limit.');
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 10_000_000) throw new Error('MC exceeds the 10 MB limit.');
        chunks.push(chunk);
      }
      return { data: Buffer.concat(chunks), mime: info.mime_type.split(';')[0].toLowerCase() };
    },
  };
}
