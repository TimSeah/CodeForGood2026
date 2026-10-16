import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createWorker } from 'tesseract.js';
import { addDays, parseDate, parseIntervals } from './dates.js';

export function createMcWorker() {
  const cachePath = process.env.OCR_CACHE_DIR ?? join(process.cwd(), 'node_modules', '.cache', 'absence-bot');
  mkdirSync(cachePath, { recursive: true });
  return createWorker('eng', 1, { cachePath });
}

export function extractMcFields(text, today) {
  const normalized = text.replace(/\r/g, '\n');
  const name = /(?:patient(?:'s)?|employee|staff|therapist)\s*name\s*[:\-]\s*([^\n]{2,80})/i.exec(normalized)?.[1]?.trim() ?? null;
  const date = '(\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|\\d{1,2}\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{4})';
  const range = new RegExp(`(?:unfit\\s+(?:for\\s+(?:work|school)\\s+)?(?:from\\s+)?|medical\\s+leave\\s+(?:from\\s+)?|rest\\s+from\\s+|absence\\s+from\\s+)\\s*:?\\s*${date}\\s*(?:to|until|through|-)\\s*${date}`, 'i');
  const single = new RegExp(`(?:unfit\\s+(?:for\\s+(?:work|school)\\s+)?on|medical\\s+leave\\s+on|rest\\s+on|absence\\s+on)\\s*:?\\s*${date}`, 'i');
  const duration = new RegExp(`(?:unfit\\s+for\\s+(?:work|school)\\s+for\\s+|medical\\s+leave\\s+for\\s+|rest\\s+for\\s+)([1-9]\\d?)\\s+days?\\s+(?:from|starting|on)\\s*:?\\s*${date}`, 'i');
  let intervals = [];
  const rangeMatch = range.exec(normalized);
  const singleMatch = single.exec(normalized);
  const durationMatch = duration.exec(normalized);
  const documentDate = (value) => {
    const monthName = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(value);
    if (!monthName) return parseDate(value);
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      .indexOf(monthName[2].slice(0, 3).toLowerCase()) + 1;
    return parseDate(`${monthName[1]}/${month}/${monthName[3]}`);
  };
  const candidate = rangeMatch ? [documentDate(rangeMatch[1]), documentDate(rangeMatch[2])] :
    singleMatch ? [documentDate(singleMatch[1])] :
      durationMatch ? [documentDate(durationMatch[2]), durationMatch[1]] : null;
  if (candidate) {
    try {
      if (candidate.some((part) => !part)) throw new Error('Unreadable date');
      const dates = durationMatch && !rangeMatch && !singleMatch ?
        `${candidate[0]} to ${addDays(candidate[0], Number(candidate[1]) - 1)}` :
        candidate.join(' to ');
      intervals = parseIntervals(dates, today);
    } catch {
      // OCR may misread a digit; do not turn uncertain dates into an absence.
    }
  }
  return { name: name && /^[\p{L} .'-]+$/u.test(name) ? name : null, intervals };
}

export async function recognizeMc(data, mime, workerFactory) {
  let text = '';
  if (mime === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('@napi-rs/canvas');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
    try {
      if (pdf.numPages > 5) throw new Error('MC exceeds the five-page limit.');
      const worker = await workerFactory();
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const embedded = content.items.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join('');
          text += `\n${embedded}`;
          if (embedded.trim().length < 40) {
            const viewport = page.getViewport({ scale: 2 });
            if (viewport.width * viewport.height > 6_000_000) throw new Error('MC page is too large to scan.');
            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            text += `\n${(await worker.recognize(canvas.toBuffer('image/png'))).data.text}`;
          }
          page.cleanup();
        }
      } finally {
        await worker.terminate();
      }
    } finally {
      await pdf.destroy();
    }
  } else if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    const worker = await workerFactory();
    try {
      text = (await worker.recognize(data)).data.text;
    } finally {
      await worker.terminate();
    }
  } else {
    throw new Error('Send an MC as a JPG, PNG, WebP or PDF.');
  }
  return text;
}
