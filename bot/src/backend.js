export class BackendError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createBackendClient({ url, secret, fetcher = fetch }) {
  const base = new URL(url);
  if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('BACKEND_URL must be a local HTTP origin (for example http://127.0.0.1:3001/).');
  }
  if (!secret) throw new Error('Set BOT_SHARED_SECRET for the backend connection.');
  const headers = { Authorization: ['Bearer', secret].join(' ') };

  async function request(path, options = {}) {
    const response = await fetcher(new URL(path, base), {
      ...options, headers: { ...headers, ...options.headers }, redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new BackendError(response.status, result?.error?.message ?? `Backend returned HTTP ${response.status}`);
    }
    if (options.pdf) return Buffer.from(await response.arrayBuffer());
    const result = await response.json();
    if (!Object.hasOwn(result, 'data')) throw new Error('Backend returned an invalid response');
    return result.data;
  }
  const post = (path, body) => request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return {
    sync: () => post('/api/intake/sync', { actor: 'whatsapp' }),
    pending: () => request('/api/whatsapp/outbox'),
    reply: (body) => post('/api/whatsapp/responses', body),
    status: (id, body) => post(`/api/whatsapp/outbox/${id}/status`, body),
    attachment: (id) => request(`/api/whatsapp/outbox/${id}/attachment`, { pdf: true }),
  };
}
