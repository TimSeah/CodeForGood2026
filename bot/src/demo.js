import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const botDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(botDir, '.env');
if (!existsSync(envFile)) throw new Error(`Missing ${envFile}`);
process.loadEnvFile(envFile);

const required = [
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'META_APP_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID', 'META_APP_SECRET', 'META_VERIFY_TOKEN',
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Set ${key} in ${envFile}`);
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const version = process.env.GRAPH_API_VERSION || 'v25.0';
if (!/^v\d+\.\d+$/.test(version)) throw new Error('GRAPH_API_VERSION is invalid.');

const fixedUrl = process.env.WEBHOOK_URL?.trim();
const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN?.trim();
if (Boolean(fixedUrl) !== Boolean(tunnelToken)) {
  throw new Error('Set both WEBHOOK_URL and CLOUDFLARE_TUNNEL_TOKEN for a named tunnel, or leave both empty for a quick tunnel.');
}
if (fixedUrl && (!fixedUrl.startsWith('https://') || !fixedUrl.endsWith('/webhook'))) {
  throw new Error('WEBHOOK_URL must be an HTTPS URL ending in /webhook.');
}

const cacheDir = join(botDir, 'node_modules', '.cache', 'absence-bot');
mkdirSync(cacheDir, { recursive: true });
const logFile = join(cacheDir, 'demo.log');
const cloudflared = process.env.CLOUDFLARED_PATH?.trim() ||
  (process.platform === 'win32' ? join(botDir, 'node_modules', '.cache', 'cloudflared.exe') : 'cloudflared');
if (cloudflared !== 'cloudflared' && !existsSync(cloudflared)) {
  throw new Error(`Cloudflared not found at ${cloudflared}. Run scripts/install-cloudflared.ps1 first.`);
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  appendFileSync(logFile, `${line}\n`);
}

const base = `https://graph.facebook.com/${version}`;
async function metaRequest(path, token, body) {
  const response = await fetch(`${base}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(`Meta ${path} returned HTTP ${response.status}, code ${result.error?.code ?? 'unknown'}`);
  }
  return result;
}

async function registerWebhook(url) {
  const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
  await metaRequest(`${process.env.META_APP_ID}/subscriptions`, appToken,
    new URLSearchParams({
      object: 'whatsapp_business_account',
      callback_url: url,
      verify_token: process.env.META_VERIFY_TOKEN,
      fields: 'messages',
    }));
  await metaRequest(`${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`, process.env.WHATSAPP_TOKEN,
    new URLSearchParams());
  log(`Webhook connected: ${url}`);
}

async function publicWebhookReady(url) {
  const challenge = 'team18-demo-ready';
  const check = new URL(url);
  check.searchParams.set('hub.mode', 'subscribe');
  check.searchParams.set('hub.verify_token', process.env.META_VERIFY_TOKEN);
  check.searchParams.set('hub.challenge', challenge);
  const response = await fetch(check, { signal: AbortSignal.timeout(5000) });
  return response.ok && await response.text() === challenge;
}

let stopping = false;
let bot;
let tunnel;
let generation = 0;
const timers = new Set();
function later(callback, delay) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (!stopping) callback();
  }, delay);
  timers.add(timer);
}

function startBot() {
  if (stopping) return;
  bot = spawn(process.execPath, ['src/server.js'], {
    cwd: botDir, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  bot.stdout.on('data', (chunk) => log(`bot: ${chunk.toString().trim()}`));
  bot.stderr.on('data', (chunk) => log(`bot error: ${chunk.toString().trim()}`));
  bot.on('error', (error) => log(`Bot failed to start: ${error.message}`));
  bot.on('exit', (code) => {
    if (stopping) return;
    log(`Bot stopped (code ${code}); restarting in 5 seconds.`);
    later(startBot, 5000);
  });
}

function registerWithRetry(url, currentGeneration) {
  if (stopping || currentGeneration !== generation) return;
  (async () => {
    if (!await publicWebhookReady(url)) throw new Error('Public webhook is not reachable yet');
    await registerWebhook(url);
  })().catch((error) => {
    if (stopping || currentGeneration !== generation) return;
    log(`Webhook setup failed: ${error.message}; retrying in 10 seconds.`);
    later(() => registerWithRetry(url, currentGeneration), 10_000);
  });
}

function startTunnel() {
  if (stopping) return;
  const currentGeneration = ++generation;
  const args = fixedUrl ? ['tunnel', 'run'] :
    ['tunnel', '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2'];
  const child = spawn(cloudflared, args, {
    cwd: botDir,
    env: { ...process.env, ...(tunnelToken ? { TUNNEL_TOKEN: tunnelToken } : {}) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  tunnel = child;
  let output = '';
  function receive(chunk) {
    output = (output + chunk.toString()).slice(-8192);
    if (!fixedUrl) {
      const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(output)?.[0];
      if (url && !child.publicUrl) {
        child.publicUrl = url;
        log(`Temporary tunnel opened: ${url}`);
        registerWithRetry(`${url}/webhook`, currentGeneration);
      }
    }
  }
  child.stdout.on('data', receive);
  child.stderr.on('data', receive);
  child.on('error', (error) => log(`Cloudflared failed to start: ${error.message}`));
  child.on('exit', (code) => {
    if (stopping) return;
    log(`Tunnel stopped (code ${code}); restarting in 5 seconds.`);
    later(startTunnel, 5000);
  });
  if (fixedUrl) registerWithRetry(fixedUrl, currentGeneration);
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const timer of timers) clearTimeout(timer);
  tunnel?.kill();
  bot?.kill();
  log('Demo launcher stopped.');
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

let portOccupied = false;
try {
  await fetch(`http://127.0.0.1:${port}/webhook`, { signal: AbortSignal.timeout(2000) });
  portOccupied = true;
} catch { /* A refused connection means this launcher can start the bot. */ }
if (portOccupied) throw new Error(`Port ${port} is already in use. Stop the old bot before starting the demo launcher.`);

log(`Starting WhatsApp demo on port ${port}.`);
startBot();
startTunnel();
